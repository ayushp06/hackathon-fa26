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
    assert(Adaptive_Command(14,75,101,900,0));
    Controls_BeginBlock(); assert(g_control_stats.status==1 && strength==37);
    window(1000,328,656); window(1100,328,656); window(1200,328,656);
    assert(Adaptive_Command(14,75,102,1200,1));
    assert(strength==37); /* still pending until a boundary */
    Controls_BeginBlock(); assert(strength==75 && g_control_stats.status==0);
    assert(g_adaptive_stats.corrections==1 && g_adaptive_stats.examples==1);
    assert(Adaptive_Command(14,75,102,1250,1)); /* retry is not another correction */
    assert(g_adaptive_stats.corrections==1);
    assert(Adaptive_Command(14,20,102,1250,1)); /* same sequence, different payload */
    Controls_BeginBlock(); assert(g_control_stats.status==1 && strength==75);
    window(1300,328,656); Controls_BeginBlock(); assert(strength==75); /* hold */
    for (uint32_t t=1400;t<=3400;t+=100) window(t,328,656);
    Controls_BeginBlock(); assert(strength==75);
    assert(Adaptive_Command(15,1,120,3400,1));
    assert(Adaptive_Command(14,75,102,3400,1));
    assert(g_adaptive_stats.corrections==1); /* old correction replay cannot train */
    /* Unknown context falls back; later return recalls the explicit preference. */
    for (uint32_t t=3500;t<=3800;t+=100) window(t,32768,32768);
    Controls_BeginBlock(); assert(strength==50);
    for (uint32_t t=3900;t<=4200;t+=100) window(t,328,656);
    Controls_BeginBlock(); assert(strength==75);
    assert(Adaptive_Command(15,0,103,4200,1));
    window(4300,32768,32768); Controls_BeginBlock(); assert(strength==75);
    assert(Adaptive_Command(16,0,104,4300,1)); assert(g_adaptive_stats.examples==0);
    assert(!Adaptive_Command(13,0,105,4300,1)); /* existing IDs remain owned by Controls */
    assert(Adaptive_Command(14,20,106,5000,1));
    Controls_BeginBlock(); assert(g_control_stats.status==1); /* stale */
    puts("audio integration passed: 25-block aggregation, foreground inference, boundary handoff, bounds, manual precedence");
    return 0;
}
