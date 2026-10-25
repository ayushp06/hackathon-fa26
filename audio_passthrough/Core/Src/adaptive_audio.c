#include "adaptive_audio.h"
#ifdef AUDIO_ADAPTIVE_ML
#include "ml_runtime.h"
#include "audio_controls.h"
#ifndef CONTROL_HOST_TEST
#include "main.h"
#endif
#include <string.h>

static adaptive_runtime policy;
static uint32_t sums[2], blocks, all_usable;
static volatile struct { uint32_t primary, reference, usable, tick, sequence; } mailbox;
static uint32_t consumed;
volatile AdaptiveStats g_adaptive_stats;

void Adaptive_Init(void)
{
    adaptive_runtime_init(&policy);
    sums[0]=sums[1]=blocks=consumed=0; all_usable=1;
    memset((void *)&mailbox,0,sizeof mailbox);
    memset((void *)&g_adaptive_stats,0,sizeof g_adaptive_stats);
    Controls_SetAdaptiveStrength(50);
}
void Adaptive_ObserveBlock(uint32_t primary, uint32_t reference, int usable, uint32_t now)
{
    sums[0]+=primary>32768U?32768U:primary;
    sums[1]+=reference>32768U?32768U:reference;
    all_usable &= usable!=0;
    if (++blocks<25U) return;
    mailbox.primary=sums[0]/25U; mailbox.reference=sums[1]/25U;
    mailbox.usable=all_usable; mailbox.tick=now; ++mailbox.sequence;
    blocks=sums[0]=sums[1]=0; all_usable=1;
}
void Adaptive_ManualOverride(void) { adaptive_runtime_enable(&policy,0); }
void Adaptive_Poll(uint32_t now, int usable)
{
    uint32_t p,r,valid,tick,sequence;
#ifndef CONTROL_HOST_TEST
    uint32_t irq=__get_PRIMASK(); __disable_irq();
#endif
    p=mailbox.primary; r=mailbox.reference; valid=mailbox.usable;
    tick=mailbox.tick; sequence=mailbox.sequence;
#ifndef CONTROL_HOST_TEST
    __DMB(); __set_PRIMASK(irq);
#endif
    if (!usable) { policy.valid=policy.stable=0; return; }
    if (sequence==consumed) return;
    consumed=sequence;
#ifndef CONTROL_HOST_TEST
    uint32_t start=DWT->CYCCNT;
#endif
    adaptive_runtime_observe(&policy,p,r,tick,valid && now-tick<=250U);
    ++g_adaptive_stats.windows;
    uint32_t percent;
    if (adaptive_runtime_predict(&policy,now,&percent)) {
        Controls_SetAdaptiveStrength(percent); ++g_adaptive_stats.predictions;
    }
#ifndef CONTROL_HOST_TEST
    uint32_t elapsed=DWT->CYCCNT-start;
    if (elapsed>g_adaptive_stats.inference_max_cycles) g_adaptive_stats.inference_max_cycles=elapsed;
#endif
    g_adaptive_stats.enabled=policy.enabled;
    g_adaptive_stats.examples=(uint32_t)policy.model.count;
    for (unsigned i=0;i<3;++i) g_adaptive_stats.context[i]=policy.context[i];
}
#endif
