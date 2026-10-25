#ifndef NOISE_FILTER_H
#define NOISE_FILTER_H
#include <stdint.h>
#define NOISE_BLOCK 64U
#define NOISE_TAPS 128U
#define NOISE_DELAY 32U
typedef struct {
    uint32_t primary_rms, reference_rms, output_rms;
    uint32_t enabled, reference_present, adapting, active, resets, clips;
} NoiseStats;
extern volatile NoiseStats g_noise_stats;
void Noise_Init(void);
void Noise_SetEnabled(uint32_t enabled);
void Noise_RequestReset(void);
void Noise_Process(const int32_t *primary, const int32_t *reference, int32_t *output);
#endif
