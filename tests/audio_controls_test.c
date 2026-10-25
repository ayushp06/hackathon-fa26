#include "../audio_passthrough/Core/Inc/audio_controls.h"
#include "../audio_passthrough/Core/Inc/noise_filter.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>

static double tone(uint8_t control,int8_t value,float frequency)
{
    Noise_Init(); Controls_Init();
    Controls_Command(control,value,1); Controls_BeginBlock();
    double power=0; unsigned count=0;
    for (unsigned block=0;block<500;++block) {
        int32_t samples[64];
        for (unsigned i=0;i<64;++i) samples[i]=(int32_t)(8388608.0f*0.001f*sinf(6.28318530718f*frequency*(block*64+i)/16000.0f));
        Controls_Process24(samples,64);
        if (block>100) for (unsigned i=0;i<64;++i) { double x=samples[i]/8388608.0; power+=x*x; ++count; }
    }
    return power/count;
}
int main(void)
{
    const float frequencies[7]={40,1000,7000,250,500,2000,4000};
    for (unsigned band=0;band<7;++band) {
        double unity=tone(band+3,0,frequencies[band]);
        double boosted=tone(band+3,6,frequencies[band]);
        double cut=tone(band+3,-6,frequencies[band]);
        double gain=10*log10(boosted/unity), attenuation=10*log10(cut/unity);
        assert(gain>5.0 && gain<6.7); assert(attenuation < -5.0 && attenuation > -6.7);
    }
    assert(10*log10(tone(2,100,2000)/tone(2,0,2000))>11.5);
    Noise_Init(); Controls_Init(); Controls_BeginBlock();
    Controls_Command(0,0,2); Controls_BeginBlock();
    int32_t samples[64];
    for (unsigned block=0;block<10;++block) {
        for (unsigned i=0;i<64;++i) samples[i]=100000;
        Controls_Process24(samples,64);
    }
    for (unsigned i=0;i<64;++i) assert(samples[i]==0);
    Controls_Command(1,37,3); Controls_BeginBlock();
    assert(g_control_stats.value[1]==37 && g_control_stats.sequence==3);
    Controls_Command(10,0,4); Controls_BeginBlock();
    Controls_Command(10,0,4); Controls_BeginBlock();
    assert(g_control_stats.relearns==1);
    Controls_Command(10,0,5); Controls_BeginBlock();
    assert(g_control_stats.relearns==2);
    Controls_Command(3,99,6); Controls_BeginBlock();
    assert(g_control_stats.status==1 && g_control_stats.value[3]==0);
    Controls_Command(11,0,7); Controls_BeginBlock();
    assert(g_control_stats.status==1);
    Controls_Command(CONTROL_LOUDNESS,101,8); Controls_BeginBlock();
    assert(g_control_stats.status==1 && g_control_stats.loudness==0);
    Controls_Command(CONTROL_SPATIAL,-1,9); Controls_BeginBlock();
    assert(g_control_stats.status==1 && g_control_stats.spatial==0);
    Controls_Command(CONTROL_SPATIAL,80,10); Controls_BeginBlock();
    assert(g_control_stats.status==0 && g_control_stats.spatial==80);

    /* Compression must preserve low inputs, reduce sustained loud inputs,
     * and bound the very first transient after settling the control ramp. */
    Noise_Init(); Controls_Init(); Controls_BeginBlock();
    Controls_Command(CONTROL_LOUDNESS,100,11); Controls_BeginBlock();
    for (unsigned block=0;block<10;++block) {
        for (unsigned i=0;i<64;++i) samples[i]=0;
        Controls_Process24(samples,64);
    }
    for (unsigned i=0;i<64;++i) samples[i]=(i&1)?-8000000:8000000;
    Controls_Process24(samples,64);
    for (unsigned i=0;i<64;++i) assert(abs(samples[i])<=2097152);
    for (unsigned block=0;block<500;++block) {
        for (unsigned i=0;i<64;++i) samples[i]=4000000;
        Controls_Process24(samples,64);
    }
    assert(samples[63]>1000000 && samples[63]<1800000);
    for (unsigned block=0;block<1000;++block) {
        for (unsigned i=0;i<64;++i) samples[i]=10000;
        Controls_Process24(samples,64);
    }
    assert(samples[63]>=9998 && samples[63]<=10001);
    Controls_Command(CONTROL_LOUDNESS,0,12); Controls_BeginBlock();
    for (unsigned block=0;block<20;++block) {
        for (unsigned i=0;i<64;++i) samples[i]=4000000;
        Controls_Process24(samples,64);
    }
    assert(samples[63]>=3999998 && samples[63]<=4000001);
    /* Exercise simultaneous maximum boosts with rapidly changing settings. */
    for (unsigned block=0;block<600;++block) {
        Controls_Command(3+block%7, (block&1)?12:-12,100+block);
        Controls_BeginBlock();
        for (unsigned i=0;i<64;++i) samples[i]=(int32_t)(1000*sinf((block*64+i)*0.3f));
        Controls_Process24(samples,64);
        for (unsigned i=0;i<64;++i) assert(samples[i]>=-8388608 && samples[i]<=8388607);
    }
    assert(g_control_stats.clips==0);
    puts("PASS: seven EQ bands boost/cut, speech gain, mute, applied controls, invalid commands and idempotent relearn");
    return 0;
}
