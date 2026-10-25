#include "noise_filter.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>

static double run(unsigned focus, float delay, unsigned missing_reference)
{
    Noise_Init(); Noise_SetStrength(100); Noise_SetSpatialFocus(focus);
    /* 38.1 mm spacing, 343 m/s, 16 kHz => 1.777 sample endfire delay.
     * At broadside the two microphones receive the same signal in phase. */
    double energy=0;
    for (unsigned block=0;block<200;++block) {
        int32_t p[64],r[64],out[64];
        for (unsigned i=0;i<64;++i) {
            float phase=6.28318530718f*4000.0f*(block*64+i)/16000.0f;
            p[i]=(int32_t)(500000*sinf(phase));
            r[i]=missing_reference?0:(int32_t)(500000*sinf(phase-delay*1.57079632679f));
        }
        Noise_Process(p,r,out);
        if (focus) assert(!g_noise_stats.adapting && !g_noise_stats.active);
        if (block>100) for (unsigned i=0;i<64;++i) energy+=(double)out[i]*out[i];
    }
    return energy;
}
int main(void)
{
    double front=run(100,0,0), side=run(100,1.77726f,0);
    double half_side=run(50,1.77726f,0), missing=run(100,0,1);
    double attenuation=10*log10(front/side);
    assert(attenuation>14 && attenuation<16);
    assert(half_side>side && half_side<front);
    assert(fabs(10*log10(missing/front))<0.05);
    /* An on-axis speech-like tone must survive a long focused run even when
     * the noise-reduction dial remains at 100%. */
    assert(front>1.0e14);
    printf("PASS: broadside speech retained, side attenuation %.2f dB at 4 kHz, intermediate focus, missing-reference fallback\n",attenuation);
    return 0;
}
