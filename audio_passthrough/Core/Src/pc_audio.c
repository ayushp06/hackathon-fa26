#include "main.h"
#include "pc_audio.h"
#include "audio.h"
#include "noise_filter.h"
#include "reference_capture.h"
#ifdef AUDIO_PC_STREAM
#define PACKET_SAMPLES 64U
#ifdef AUDIO_NLMS
#define PACKET_HEADER 32U
#else
#define PACKET_HEADER 16U
#endif
#define PACKET_SIZE (PACKET_HEADER + PACKET_SAMPLES * 2U + 2U)
#define QUEUE_SIZE 8U
static uint8_t packets[QUEUE_SIZE][PACKET_SIZE];
static volatile uint32_t produced, consumed;
static uint32_t sequence;
volatile uint32_t g_pc_audio_dropped;
volatile uint32_t g_pc_audio_uart_errors;

static void put16(uint8_t *p, uint16_t value)
{
    p[0] = (uint8_t)value; p[1] = (uint8_t)(value >> 8);
}
static void put32(uint8_t *p, uint32_t value)
{
    put16(p, (uint16_t)value); put16(p + 2, (uint16_t)(value >> 16));
}
static uint16_t crc16(const uint8_t *p, uint32_t size)
{
    uint16_t crc = 0xffff;
    while (size--) {
        crc ^= (uint16_t)*p++ << 8;
        for (uint32_t bit = 0; bit < 8; ++bit) {
            crc = (uint16_t)((crc << 1) ^ ((crc & 0x8000U) ? 0x1021U : 0U));
        }
    }
    return crc;
}

void PC_Audio_Queue(const int16_t *samples)
{
    uint32_t seq = sequence++;
    if (produced - consumed >= QUEUE_SIZE) { ++g_pc_audio_dropped; return; }
    uint8_t *p = packets[produced % QUEUE_SIZE];
    p[0] = 'M'; p[1] = 'I'; p[2] = 'C'; p[3] = '1';
    put32(p + 4, seq);
    put32(p + 8, 16000U);
    put16(p + 12, PACKET_SAMPLES);
    put16(p + 14, (g_pc_audio_dropped ? 1U : 0U) | (g_audio_stats.fault << 8));
#ifdef AUDIO_NLMS
    p[3] = '2';
    uint16_t flags = (g_pc_audio_dropped ? 1U : 0U) | 2U
        | (!g_noise_stats.reference_present ? 4U : 0U)
        | (!g_noise_stats.adapting ? 8U : 0U)
        | (g_noise_stats.resets ? 16U : 0U)
        | (!g_noise_stats.enabled ? 32U : 0U)
        | (g_noise_stats.clips ? 64U : 0U) | (g_audio_stats.fault << 8);
    put16(p + 14, flags);
    put32(p + 16, g_noise_stats.primary_rms);
    put32(p + 20, g_noise_stats.reference_rms);
    put32(p + 24, g_noise_stats.output_rms);
    put32(p + 28, g_audio_stats.max_callback_cycles);
    if (g_audio_stats.fault) {
#ifdef AUDIO_DUAL_DATA
        p[14] |= 128U;
        for (uint32_t word = 0; word < 4U; ++word) put32(p + 16U + word * 4U, dual_fault_words[word]);
#else
        put32(p + 16, g_audio_stats.sync_errors);
        put32(p + 20, g_audio_stats.overruns);
        put32(p + 24, g_audio_stats.frame_errors);
        put32(p + 28, g_audio_stats.hal_error);
#endif
    }
#endif
    for (uint32_t i = 0; i < PACKET_SAMPLES; ++i) {
        put16(p + PACKET_HEADER + i * 2U, (uint16_t)samples[i]);
    }
    put16(p + PACKET_SIZE - 2U, crc16(p, PACKET_SIZE - 2U));
    __DMB();
    ++produced;
}

void PC_Audio_Poll(void)
{
#ifdef AUDIO_NLMS
    if (__HAL_UART_GET_FLAG(&huart2, UART_FLAG_RXNE)) {
        uint8_t command;
        if (HAL_UART_Receive(&huart2, &command, 1, 0) == HAL_OK) {
            if (command == 'b') Noise_SetEnabled(0);
            if (command == 'n') Noise_SetEnabled(1);
            if (command == 'r') Noise_RequestReset();
        }
    }
#endif
    if (consumed == produced) { return; }
    __DMB();
    /* Foreground only; a packet takes under 1.8 ms at 921600 baud.
     * I2S DMA callbacks preempt this transfer and never call UART routines. */
    if (HAL_UART_Transmit(&huart2, packets[consumed % QUEUE_SIZE], PACKET_SIZE, 10) != HAL_OK) {
        ++g_pc_audio_uart_errors;
    }
    __DMB();
    ++consumed;
}
void PC_Audio_ReportFault(void)
{
    /* Capture is stopped on a latched fault: foreground is now the only
     * producer. Keep fault diagnostics available even without DMA callbacks. */
    static const int16_t silence[PACKET_SAMPLES] = {0};
    PC_Audio_Queue(silence);
    PC_Audio_Poll();
}
#endif
