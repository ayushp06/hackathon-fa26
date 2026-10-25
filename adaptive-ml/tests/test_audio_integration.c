#include "adaptive_audio.h"
#include "audio_controls.h"
#include "noise_filter.h"
#include <assert.h>
#include <stdio.h>

static uint32_t strength;
/* Test the actual Controls block-boundary handoff without a hardware/HAL dependency. */
void Noise_SetStrength(uint32_t percent) { strength=percent; }
void Noise_SetSpatialFocus(uint32_t percent) { (void)percent; }
void Noise_RequestReset(void) {}
static void window(uint32_t now, uint32_t primary, uint32_t reference)
{
    for (unsigned i=0;i<25;++i)
        Adaptive_ObserveBlock(primary,reference,reference!=0,now-96+i*4);
    Adaptive_Poll(now,1);
}
int main(void)
{
    Controls_Init(); Adaptive_Init();
    assert(strength==0); /* pending settings are not applied in foreground */
    Controls_BeginBlock(); assert(strength==50);
    window(100,328,656); window(200,328,656); window(300,328,656);
    assert(g_adaptive_stats.predictions==1);
    Controls_SetAdaptiveStrength(101);
    assert(strength==50);
    Controls_BeginBlock(); assert(strength==100);
    Controls_Command(1,37,100); /* ordinary manual command wins, no feedback */
    Controls_BeginBlock(); assert(strength==37 && g_control_stats.sequence==100);
    window(400,328,656); window(500,328,656);
    Controls_BeginBlock(); assert(strength==37);
    assert(g_adaptive_stats.examples==0 && g_adaptive_stats.enabled==0);
    uint32_t predictions=g_adaptive_stats.predictions;
    for (unsigned i=0;i<24;++i) Adaptive_ObserveBlock(328,656,1,600+i*4);
    Adaptive_Poll(696,1); assert(g_adaptive_stats.predictions==predictions);
    Adaptive_Poll(900,0); /* fault/spatial gate */
    puts("audio integration passed: 25-block aggregation, foreground inference, boundary handoff, bounds, manual precedence");
    return 0;
}
