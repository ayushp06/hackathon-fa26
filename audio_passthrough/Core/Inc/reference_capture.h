#ifndef REFERENCE_CAPTURE_H
#define REFERENCE_CAPTURE_H
#include "audio.h"
#ifdef AUDIO_DUAL_DATA
extern I2S_HandleTypeDef hi2s3;
extern DMA_HandleTypeDef hdma_i2s3_rx;
extern uint16_t reference_rx[AUDIO_RING_WORDS];
extern volatile uint32_t reference_capture_running;
void Reference_Init(void);
HAL_StatusTypeDef Reference_Start(void);
void Audio_ReferenceHalfReady(uint32_t half);
void Reference_ProbeClocks(void);
extern volatile uint32_t dual_primary_events, dual_reference_events, dual_stage, dual_clock_flags;
extern volatile uint32_t dual_fault_words[4];
#endif
#endif
