#include "adaptive_audio.h"
#include "audio_controls.h"
#include "noise_filter.h"
#include "ml_runtime.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>

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
        assert(g_control_stats.value[1]>=0 && g_control_stats.value[1]<=100);
        Adaptive_Poll(block*4,1);
        if (b+100>=count) for (unsigned i=0;i<NOISE_BLOCK;++i) {
            double v=output[i]/8388608.0;
            energy+=v*v;
            assert(output[i]>=-8388608 && output[i]<=8388607);
        }
    }
    return energy;
}
/* Radius=.15: with only one relevant example, |error|=|target-50|*d/.15.
 * +/-10 points permits d<=.05 for A, <=.075 for B. Both scenes must
 * additionally remain outside the other example's radius. No tuning here. */
static void command(unsigned id, unsigned value, unsigned sequence)
{
    assert(Adaptive_Command(id,value,sequence,block*4,1));
    Controls_BeginBlock();
    assert(g_control_stats.sequence==sequence && g_control_stats.status==0);
}
static void recall(float amplitude, int target)
{
    run(600,amplitude); /* 2.4 s: beyond global hold and 3x100 ms stability */
    int low=100, high=0;
    for (unsigned i=0;i<200;++i) {
        run(1,amplitude);
        int value=g_control_stats.value[1];
        if (value<low) low=value;
        if (value>high) high=value;
        assert(abs(value-target)<=10);
        assert(g_adaptive_stats.corrections==2 && g_adaptive_stats.examples==2);
        assert(g_adaptive_stats.enabled==1);
    }
    assert(high-low<=2); /* stationary jitter, no large oscillation */
    printf("target=%d applied=%d..%d error=%d..%d context=%.6f,%.6f\n",
           target,low,high,low-target,high-target,
           g_adaptive_stats.context[0],g_adaptive_stats.context[1]);
}
int main(void)
{
    Noise_Init(); Controls_Init(); Adaptive_Init();
    command(16,0,1); command(15,1,2);
    run(600,0.15f); assert(g_control_stats.value[1]==50);
    float a[3]; for(unsigned i=0;i<3;++i) a[i]=g_adaptive_stats.context[i];
    command(14,80,3); assert(g_adaptive_stats.corrections==1);
    run(400,0.15f); assert(g_control_stats.value[1]==80); /* 1.6s hold */
    run(600,0.0015f); assert(g_control_stats.value[1]==50);
    float d2=0;
    for(unsigned i=0;i<3;++i) {
        float d=a[i]-g_adaptive_stats.context[i]; d2+=d*d/3;
    }
    assert(sqrtf(d2)>0.30f); /* disjoint radius .15 neighborhoods */
    printf("SYNTHETIC real-DSP two-context separation=%.6f\n",sqrtf(d2));
    command(14,30,4);
    run(400,0.0015f); assert(g_control_stats.value[1]==30);
    for(unsigned i=0;i<10;++i) { recall(0.15f,80); recall(0.0015f,30); }
    assert(g_noise_stats.resets==0 && g_control_stats.clips==0);
    assert(g_control_stats.sequence==4); /* recall sends no commands */
    /* Identical measured contexts cannot encode contradictory semantic scenes. */
    adaptive_runtime r; adaptive_runtime_init(&r);
    for(unsigned t=0;t<=200;t+=100) adaptive_runtime_observe(&r,100,200,t,1);
    assert(adaptive_runtime_correct(&r,200,80,1));
    assert(adaptive_runtime_correct(&r,200,30,2));
    assert(r.model.count==1); /* exact duplicate replaces selected target */
    for(unsigned t=300;t<=2300;t+=100) adaptive_runtime_observe(&r,100,200,t,1);
    uint32_t predicted;
    assert(adaptive_runtime_predict(&r,2300,&predicted) && predicted==30);
    printf("Ambiguous identical RMS: latest target=%u, earlier 80 error=-50; no scene identity\n",predicted);
    return 0;
}
