#ifndef PC_AUDIO_H
#define PC_AUDIO_H
#include <stdint.h>
/* ISR producer / foreground consumer. Blocks always contain 64 mono samples. */
void PC_Audio_Queue(const int16_t *samples);
void PC_Audio_Init(void);
void PC_Audio_Poll(void);
void PC_Audio_ReportFault(void);
extern volatile uint32_t g_pc_audio_dropped;
extern volatile uint32_t g_pc_audio_uart_errors;
#endif
