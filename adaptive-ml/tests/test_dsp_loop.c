#include "adaptive_audio.h"
#include "audio_controls.h"
#include "noise_filter.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>

static unsigned rng=12345, block;
static double run(unsigned count, float amplitude)
{
    double energy=0;
    for (unsigned b=0;b<count;++b,++block) {
        int32_t primary[NOISE_BLOCK], reference[NOISE_BLOCK], output[NOISE_BLOCK];
        for (unsigned i=0;i<NOISE_BLOCK;++i) {
            rng^=rng<<13; rng^=rng>>17; rng^=rng<<5;
            float x=((float)(rng&65535U)/32768.0f-1)*amplitude;
            reference[i]=(int32_t)(x*8388608.0f);
            primary[i]=(int32_t)(x*0.6f*8388608.0f);
        }
        Controls_BeginBlock();
        Noise_Process(primary,reference,output);
        Adaptive_ObserveBlock(g_noise_stats.primary_rms,g_noise_stats.reference_rms,
                              g_noise_stats.reference_present,block*4);
        Controls_Process24(output,NOISE_BLOCK);
        Adaptive_Poll(block*4,1);
        if (b+100>=count) for (unsigned i=0;i<NOISE_BLOCK;++i) {
            double v=output[i]/8388608.0;
            energy+=v*v;
            assert(output[i]>=-8388608 && output[i]<=8388607);
        }
    }
    return energy;
}
int main(void)
{
    Noise_Init(); Controls_Init(); Adaptive_Init();
    double before=run(600,0.15f);
    assert(g_control_stats.value[1]==50);
    assert(Adaptive_Command(14,90,1,block*4,1));
    Controls_BeginBlock(); assert(g_control_stats.status==0);
    double corrected=run(600,0.15f);
    assert(g_control_stats.value[1]>=88 && g_control_stats.value[1]<=90);
    assert(corrected < before*0.1); /* actual DSP waveform changes */
    run(200,0.00015f); /* unfamiliar digital context */
    assert(g_control_stats.value[1]==50);
    double recalled=run(600,0.15f);
    assert(g_control_stats.value[1]>=88 && g_control_stats.value[1]<=90);
    assert(recalled < before*0.1 && g_adaptive_stats.corrections==1);
    assert(g_noise_stats.resets==0 && g_control_stats.clips==0);
    printf("SYNTHETIC DSP loop passed: baseline=50 corrected=%d recalled=%d, energy ratios %.4f/%.4f\n",
           g_control_stats.value[1],g_control_stats.value[1],corrected/before,recalled/before);
    return 0;
}
