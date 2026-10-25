#ifndef ADAPTIVE_AUDIO_H
#define ADAPTIVE_AUDIO_H
#include <stdint.h>
typedef struct {
    uint32_t windows, predictions, corrections, examples, enabled;
    uint32_t inference_max_cycles, update_max_cycles;
    float context[3];
} AdaptiveStats;
extern volatile AdaptiveStats g_adaptive_stats;
void Adaptive_Init(void);
/* Audio ISR only: cheap accumulation of pre-processing RMS, no model calls. */
void Adaptive_ObserveBlock(uint32_t primary, uint32_t reference, int usable, uint32_t now);
void Adaptive_Poll(uint32_t now, int usable);
void Adaptive_ManualOverride(void);
#endif
