#include "main.h"
#include "pc_audio.h"
#include "audio.h"
#include "noise_filter.h"
#include "reference_capture.h"
#include "audio_controls.h"
#ifdef AUDIO_ADAPTIVE_ML
#include "adaptive_audio.h"
#endif
#ifdef AUDIO_PC_STREAM
#define PACKET_SAMPLES 64U
#ifdef AUDIO_APP_CONTROL
#define PACKET_HEADER 56U
#elif defined(AUDIO_NLMS)
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
#ifdef AUDIO_APP_CONTROL
static volatile uint32_t command_written,command_read;
static uint8_t command_ring[64];
static DMA_HandleTypeDef uart_tx_dma;
static volatile uint32_t uart_tx_busy;
void DMA1_Stream6_IRQHandler(void) { HAL_DMA_IRQHandler(&uart_tx_dma); }
void HAL_UART_TxCpltCallback(UART_HandleTypeDef *uart)
{
    if (uart==&huart2) { ++consumed; uart_tx_busy=0; }
}
void HAL_UART_ErrorCallback(UART_HandleTypeDef *uart)
{
    if (uart==&huart2) {
        ++g_pc_audio_uart_errors;
        if (uart_tx_busy) { ++consumed; ++g_pc_audio_dropped; uart_tx_busy=0; }
    }
}
/* This tiny IRQ preempts DSP so ten-byte commands cannot overrun USART2's
 * one-byte receive register while NLMS or foreground PCM transmission runs. */
void USART2_IRQHandler(void)
{
    uint32_t status=USART2->SR;
    if (status & (USART_SR_RXNE | USART_SR_ORE | USART_SR_FE | USART_SR_NE)) {
        uint8_t value=(uint8_t)USART2->DR;
        if (status & (USART_SR_ORE | USART_SR_FE | USART_SR_NE)) ++g_pc_audio_uart_errors;
        if ((status & USART_SR_RXNE) && command_written-command_read<sizeof command_ring) {
            command_ring[command_written%sizeof command_ring]=value;
            __DMB(); ++command_written;
        }
    }
    /* HAL completes normal-mode TX DMA on USART TC after the last byte. */
    if ((USART2->SR & USART_SR_TC) && (USART2->CR1 & USART_CR1_TCIE)) HAL_UART_IRQHandler(&huart2);
}
#endif
void PC_Audio_Init(void)
{
#ifdef AUDIO_APP_CONTROL
    __HAL_RCC_DMA1_CLK_ENABLE();
    uart_tx_dma.Instance=DMA1_Stream6;
    uart_tx_dma.Init.Channel=DMA_CHANNEL_4;
    uart_tx_dma.Init.Direction=DMA_MEMORY_TO_PERIPH;
    uart_tx_dma.Init.PeriphInc=DMA_PINC_DISABLE;
    uart_tx_dma.Init.MemInc=DMA_MINC_ENABLE;
    uart_tx_dma.Init.PeriphDataAlignment=DMA_PDATAALIGN_BYTE;
    uart_tx_dma.Init.MemDataAlignment=DMA_MDATAALIGN_BYTE;
    uart_tx_dma.Init.Mode=DMA_NORMAL;
    uart_tx_dma.Init.Priority=DMA_PRIORITY_LOW;
    uart_tx_dma.Init.FIFOMode=DMA_FIFOMODE_DISABLE;
    if (HAL_DMA_Init(&uart_tx_dma)!=HAL_OK) Error_Handler();
    __HAL_LINKDMA(&huart2,hdmatx,uart_tx_dma);
    HAL_NVIC_SetPriority(DMA1_Stream6_IRQn,0,0);
    HAL_NVIC_EnableIRQ(DMA1_Stream6_IRQn);
    HAL_NVIC_SetPriority(USART2_IRQn,0,0);
    HAL_NVIC_EnableIRQ(USART2_IRQn);
    __HAL_UART_ENABLE_IT(&huart2,UART_IT_RXNE);
#endif
}

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
 #ifdef AUDIO_APP_CONTROL
    p[3]='4';
    if (!g_audio_stats.fault) put32(p+24,g_control_stats.output_rms);
    if (g_control_stats.clips) p[14]|=64U;
    put32(p+32,g_control_stats.sequence);
    for (uint32_t i=0;i<CONTROL_COUNT;++i) p[36+i]=(uint8_t)g_control_stats.value[i];
    p[46]=g_control_stats.status;
#ifdef AUDIO_DUAL_DATA
    p[47]=(uint8_t)reference_capture_running;
#else
    p[47]=1;
#endif
    put32(p+48,g_control_stats.relearns);
    p[52]=g_control_stats.loudness;
    p[53]=g_control_stats.spatial;
    p[54]=(uint8_t)(g_control_stats.spatial && g_noise_stats.reference_present);
    p[55]=38U; /* Nominal microphone spacing in millimeters. */
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
    for (;;) {
        uint8_t command;
#ifdef AUDIO_APP_CONTROL
        if (command_read==command_written) break;
        __DMB(); command=command_ring[command_read%sizeof command_ring]; ++command_read;
#else
        if (!__HAL_UART_GET_FLAG(&huart2,UART_FLAG_RXNE)) break;
        if (HAL_UART_Receive(&huart2,&command,1,0)!=HAL_OK) break;
#endif
        {
#ifdef AUDIO_APP_CONTROL
            static uint8_t frame[10];
            static uint32_t received,last_byte_tick;
            if (HAL_GetTick()-last_byte_tick>100U) received=0;
            last_byte_tick=HAL_GetTick();
            if (received || command==0xa5U) {
                frame[received++]=command;
                if (received==2U && frame[1]!=0x5aU) received=0;
                if (received==sizeof frame) {
                    if (crc16(frame,8)==(uint16_t)(frame[8] | ((uint16_t)frame[9]<<8))) {
                        uint32_t sequence=(uint32_t)frame[4] | ((uint32_t)frame[5]<<8)
                            | ((uint32_t)frame[6]<<16) | ((uint32_t)frame[7]<<24);
                        /* Explicit app recovery remains available while a
                         * capture fault is latched and DSP callbacks stopped. */
                        if (frame[2]==11U && frame[3]==0U) NVIC_SystemReset();
#ifdef AUDIO_ADAPTIVE_ML
                        if (!Adaptive_Command(frame[2],(int8_t)frame[3],sequence,HAL_GetTick(),
                            !g_audio_stats.fault && !g_control_stats.spatial && g_noise_stats.reference_present))
#endif
                        Controls_Command(frame[2],(int8_t)frame[3],sequence);
                    }
                    received=0;
                }
                continue;
            }
#endif
            if (command == 'b' || command == 'n') {
#ifdef AUDIO_ADAPTIVE_ML
                Adaptive_ManualOverride();
#endif
                Noise_SetEnabled(command=='n');
            }
            if (command == 'r') Noise_RequestReset();
        }
    }
#endif
    if (consumed == produced) { return; }
    __DMB();
#ifdef AUDIO_APP_CONTROL
    /* Keep this queue slot owned until TC, so circular capture cannot reuse
     * memory while UART DMA is still reading it. */
    if (uart_tx_busy) return;
    uart_tx_busy=1;
    if (HAL_UART_Transmit_DMA(&huart2,packets[consumed%QUEUE_SIZE],PACKET_SIZE)!=HAL_OK) {
        uart_tx_busy=0; ++g_pc_audio_uart_errors;
    }
#else
    /* Foreground only; a MIC3 packet takes about 2 ms at 921600 baud.
     * I2S DMA callbacks preempt this transfer and never call UART routines. */
    if (HAL_UART_Transmit(&huart2, packets[consumed % QUEUE_SIZE], PACKET_SIZE, 10) != HAL_OK) {
        ++g_pc_audio_uart_errors;
    }
    __DMB();
    ++consumed;
#endif
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
