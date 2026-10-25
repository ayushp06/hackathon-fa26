#ifndef AUDIO_H
#define AUDIO_H
#include "main.h"
#define AUDIO_SAMPLE_RATE 16000U
#define AUDIO_BLOCK_FRAMES 64U
#define AUDIO_RING_FRAMES (2U * AUDIO_BLOCK_FRAMES)
#define AUDIO_HALFWORDS_PER_FRAME 4U
#define AUDIO_HALF_WORDS (AUDIO_BLOCK_FRAMES * AUDIO_HALFWORDS_PER_FRAME)
#define AUDIO_RING_WORDS (2U * AUDIO_HALF_WORDS)
/* Unity gain: preserve the microphone's digital level without amplification. */
#define AUDIO_GAIN_NUM 1
#define AUDIO_GAIN_DEN 1
#define AUDIO_WARMUP_BLOCKS 64U
#define AUDIO_REPORT_INTERVAL_MS 100U

typedef struct {
    uint32_t i2s_initialized, dma_started;
    uint32_t rx_blocks, tx_blocks, nonzero_samples, right_nonzero_samples, changing_samples;
    int32_t last_sample;
    uint32_t peak, clipped_samples, max_callback_cycles;
    uint32_t sync_errors, deadline_errors, dma_errors;
    uint32_t overruns, underruns, frame_errors, stalls;
    uint32_t hal_error, fault;
} AudioStats;

enum { AUDIO_FAULT_NONE, AUDIO_FAULT_INIT, AUDIO_FAULT_START,
       AUDIO_FAULT_SYNC, AUDIO_FAULT_DEADLINE, AUDIO_FAULT_DMA,
       AUDIO_FAULT_I2S, AUDIO_FAULT_STALL, AUDIO_FAULT_CPU };

extern volatile AudioStats g_audio_stats;
HAL_StatusTypeDef Audio_Start(void);
void Audio_Fault(uint32_t reason);
void Audio_CheckI2SErrors(void);
#endif
