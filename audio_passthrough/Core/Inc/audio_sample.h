#ifndef AUDIO_SAMPLE_H
#define AUDIO_SAMPLE_H
#include <stdint.h>

/* DMA reads the 16-bit I2S DR twice per channel, MS halfword FIRST.
 * Each stereo frame is [L_hi, L_lo, R_hi, R_lo]. Low eight slot bits
 * are padding/tri-state and must never be interpreted as microphone data. */
static inline int32_t Audio_Unpack24(const uint16_t *slot)
{
    uint32_t bits = (((uint32_t)slot[0] << 16) | slot[1]) >> 8;
    return (bits & 0x00800000U) ? (int32_t)bits - 0x01000000 : (int32_t)bits;
}

static inline int32_t Audio_Scale24(int32_t sample, int32_t gain_num, int32_t gain_den)
{
    int64_t scaled = (int64_t)sample * gain_num / gain_den;
    if (scaled > 8388607) { scaled = 8388607; }
    if (scaled < -8388608) { scaled = -8388608; }
    return (int32_t)scaled;
}

static inline void Audio_PackStereo24(uint16_t *frame, int32_t sample)
{
    /* Convert to unsigned BEFORE shifting to avoid signed-shift UB. */
    uint32_t packed = (uint32_t)sample << 8;
    frame[0] = frame[2] = (uint16_t)(packed >> 16);
    frame[1] = frame[3] = (uint16_t)packed;
}
#endif
