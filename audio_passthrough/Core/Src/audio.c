#include "audio.h"
#include "audio_sample.h"
#include "pc_audio.h"
#include "noise_filter.h"
#include "reference_capture.h"
#include "audio_controls.h"
#include <string.h>

/* DMA buffers contain HALFWORDS, never native-endian uint32_t samples. */
static uint16_t rx[AUDIO_RING_WORDS] __attribute__((aligned(4)));
static uint16_t tx[AUDIO_RING_WORDS] __attribute__((aligned(4)));
volatile AudioStats g_audio_stats;
static uint32_t expected_half;
static uint32_t last_callback;
static int32_t previous_sample;
#ifdef AUDIO_DUAL_DATA
static uint32_t ready_halves[2];
#endif
#ifdef AUDIO_NLMS
static int32_t primary_block[NOISE_BLOCK], reference_block[NOISE_BLOCK], clean_block[NOISE_BLOCK];
#endif
#ifdef AUDIO_DAC_TEST_TONE
/* Continuous 250 Hz at 16 kHz, about -30 dBFS. Each LUT value lasts
 * four samples: 16 * 4 = 64 samples/period. Suitable for a meter check.
 * Diagnostic build only: microphone capture and counters still run. */
static const int16_t test_sine[16] = {
    0, 12539, 23170, 30273, 32767, 30273, 23170, 12539,
    0, -12539, -23170, -30273, -32767, -30273, -23170, -12539
};
#endif

void Audio_Fault(uint32_t reason)
{
#ifdef AUDIO_DUAL_DATA
    if (!g_audio_stats.fault && hdma_i2s3_rx.Instance != NULL) {
        dual_fault_words[0] = __HAL_DMA_GET_COUNTER(&hdma_i2s2_ext_rx)
            | (__HAL_DMA_GET_COUNTER(&hdma_i2s3_rx) << 16);
        dual_fault_words[1] = __HAL_DMA_GET_COUNTER(&hdma_i2s2_tx)
            | (dual_clock_flags << 16) | (dual_stage << 24);
        dual_fault_words[2] = dual_primary_events | (dual_reference_events << 16);
        dual_fault_words[3] = SPI3->I2SCFGR | ((SPI3->SR & 255U) << 16) | ((SPI3->CR2 & 255U) << 24);
    }
#endif
    if (!g_audio_stats.fault) { g_audio_stats.fault = reason; }
    /* Immediate stop prevents reuse of a corrupt output half. HAL cleanup is
     * done by foreground, never a blocking HAL abort inside a DMA callback. */
    SPI2->CR2 &= ~(SPI_CR2_TXDMAEN | SPI_CR2_ERRIE);
    I2S2ext->CR2 &= ~(SPI_CR2_RXDMAEN | SPI_CR2_ERRIE);
    SPI2->I2SCFGR &= ~SPI_I2SCFGR_I2SE;
    I2S2ext->I2SCFGR &= ~SPI_I2SCFGR_I2SE;
#ifdef AUDIO_DUAL_DATA
    SPI3->CR2 &= ~(SPI_CR2_RXDMAEN | SPI_CR2_ERRIE);
    SPI3->I2SCFGR &= ~SPI_I2SCFGR_I2SE;
#endif
    __DSB();
}

HAL_StatusTypeDef Audio_Start(void)
{
    memset(rx, 0, sizeof rx);
    memset(tx, 0, sizeof tx);
    expected_half = 0;
    last_callback = 0;
#ifdef AUDIO_NLMS
    Noise_Init();
#ifdef AUDIO_APP_CONTROL
    Controls_Init();
#endif
#endif
#ifdef AUDIO_DUAL_DATA
    ready_halves[0] = ready_halves[1] = 0;
#endif
    /* For HAL's 24/32-bit mode, Size counts CHANNEL SAMPLES, not halfwords.
     * 128 stereo frames * 2 channels = 256; HAL doubles to 512 halfwords.
     * A half callback therefore represents 64 stereo frames = 4 ms. */
    HAL_StatusTypeDef status = HAL_I2SEx_TransmitReceive_DMA(
        &hi2s2, tx, rx, AUDIO_RING_FRAMES * 2U);
    if (status != HAL_OK || hdma_i2s2_ext_rx.ErrorCode || hdma_i2s2_tx.ErrorCode
        || !(hdma_i2s2_ext_rx.Instance->CR & DMA_SxCR_EN)
        || !(hdma_i2s2_tx.Instance->CR & DMA_SxCR_EN)) {
        g_audio_stats.hal_error = hi2s2.ErrorCode;
        Audio_Fault(AUDIO_FAULT_START);
        return HAL_ERROR;
    }
    g_audio_stats.dma_started = 1;
#ifdef AUDIO_DUAL_DATA
    HAL_StatusTypeDef reference_status=Reference_Start();
#ifdef AUDIO_APP_CONTROL
    /* Keep the voice controls usable if the external WS loopback is missing.
     * RX3 has not been enabled on HAL_TIMEOUT; its zero buffer provides a
     * missing reference and NLMS explicitly bypasses. MIC3 reports this state. */
    if (reference_status==HAL_TIMEOUT) Reference_ProbeClocks();
    else
#endif
    if (reference_status != HAL_OK) {
        Reference_ProbeClocks();
        Audio_Fault(AUDIO_FAULT_START);
        return HAL_ERROR;
    }
#endif
    /* HAL's DMA API does not enable I2S peripheral error interrupts. */
    SPI2->CR2 |= SPI_CR2_ERRIE;
    I2S2ext->CR2 |= SPI_CR2_ERRIE;
#ifdef AUDIO_DUAL_DATA
    if (reference_capture_running) SPI3->CR2 |= SPI_CR2_ERRIE;
#endif
    return HAL_OK;
}

static uint32_t active_half(DMA_HandleTypeDef *dma)
{
    uint32_t remaining = __HAL_DMA_GET_COUNTER(dma);
    return (remaining > AUDIO_HALF_WORDS || remaining == 0U) ? 0U : 1U;
}

void Audio_CheckI2SErrors(void)
{
    uint32_t tx_status = SPI2->SR;
    uint32_t rx_status = I2S2ext->SR;
    uint32_t errors = 0;
#ifdef AUDIO_DUAL_DATA
    uint32_t ref_status = SPI3->SR;
    if (reference_capture_running && (ref_status & SPI_SR_OVR)) { ++g_audio_stats.overruns; errors = 1; }
    if (reference_capture_running && (ref_status & SPI_SR_FRE)) { ++g_audio_stats.frame_errors; errors = 1; }
#endif
    if (rx_status & SPI_SR_OVR) { ++g_audio_stats.overruns; errors = 1; }
    if (tx_status & SPI_SR_UDR) { ++g_audio_stats.underruns; errors = 1; }
    if ((tx_status | rx_status) & SPI_SR_FRE) { ++g_audio_stats.frame_errors; errors = 1; }
    if (errors) {
#ifdef AUDIO_DUAL_DATA
        dual_stage = ((tx_status & SPI_SR_FRE) ? 4U : 0U)
            | ((rx_status & SPI_SR_FRE) ? 8U : 0U)
            | ((ref_status & SPI_SR_FRE) ? 16U : 0U);
#endif
        g_audio_stats.hal_error |= ((rx_status & SPI_SR_OVR) ? HAL_I2S_ERROR_OVR : 0U)
                                | ((tx_status & SPI_SR_UDR) ? HAL_I2S_ERROR_UDR : 0U);
        Audio_Fault(AUDIO_FAULT_I2S);
        /* Clear receiver OVR on the extension (not the main transmitter). */
        (void)I2S2ext->DR;
        (void)I2S2ext->SR;
#ifdef AUDIO_DUAL_DATA
        (void)SPI3->DR;
        (void)SPI3->SR;
#endif
    }
}

static void process_half(uint32_t half)
{
    uint32_t started = DWT->CYCCNT;
    if (g_audio_stats.fault) { return; }
    uint32_t block_cycles = SystemCoreClock / (AUDIO_SAMPLE_RATE / AUDIO_BLOCK_FRAMES);
    /* NDTR alone cannot reveal a whole missed ring rotation. Detect delayed
     * IRQ service as well; normal jitter is far below the 1 ms allowance. */
    if (g_audio_stats.rx_blocks && started - last_callback > block_cycles + block_cycles / 4U) {
        ++g_audio_stats.deadline_errors;
        Audio_Fault(AUDIO_FAULT_DEADLINE);
        return;
    }
    last_callback = started;
    Audio_CheckI2SErrors();
    if (g_audio_stats.fault) { return; }
    if (half != expected_half || active_half(&hdma_i2s2_ext_rx) == half
                              || active_half(&hdma_i2s2_tx) == half
#ifdef AUDIO_DUAL_DATA
                              || (reference_capture_running && active_half(&hdma_i2s3_rx) == half)
#endif
       ) {
#ifdef AUDIO_DUAL_DATA
        dual_stage = 2;
#endif
        ++g_audio_stats.sync_errors;
        Audio_Fault(AUDIO_FAULT_SYNC);
        return;
    }
    expected_half ^= 1U;
    uint32_t offset = half * AUDIO_HALF_WORDS;
    uint32_t peak = 0;
    uint32_t mute = (g_audio_stats.rx_blocks < AUDIO_WARMUP_BLOCKS);
#ifdef AUDIO_PC_STREAM
    int16_t pc_samples[AUDIO_BLOCK_FRAMES];
#endif
    for (uint32_t frame = 0; frame < AUDIO_BLOCK_FRAMES; ++frame) {
        uint32_t i = offset + AUDIO_HALFWORDS_PER_FRAME * frame;
        /* L/R grounded selects the first (WS low/left) channel. */
        int32_t sample = Audio_Unpack24(&rx[i]);
#ifdef AUDIO_DUAL_DATA
        int32_t reference_sample = Audio_Unpack24(&reference_rx[i]);
#ifdef AUDIO_SWAP_MIC_INPUTS
        int32_t temporary = sample;
        sample = reference_sample;
        reference_sample = temporary;
#endif
#else
        int32_t reference_sample = Audio_Unpack24(&rx[i + 2U]);
#endif
        if (reference_sample) { ++g_audio_stats.right_nonzero_samples; }
#ifdef AUDIO_NLMS
        primary_block[frame] = sample;
        reference_block[frame] = reference_sample;
#endif
        if (sample) { ++g_audio_stats.nonzero_samples; }
        if (sample != previous_sample) { ++g_audio_stats.changing_samples; }
        previous_sample = sample;
        uint32_t magnitude = (uint32_t)(sample < 0 ? -sample : sample);
        if (magnitude > peak) { peak = magnitude; }
        int32_t output = Audio_Scale24(sample, AUDIO_GAIN_NUM, AUDIO_GAIN_DEN);
        if ((int64_t)sample * AUDIO_GAIN_NUM / AUDIO_GAIN_DEN != output) {
            ++g_audio_stats.clipped_samples;
        }
#ifdef AUDIO_DAC_TEST_TONE
        output = (int32_t)test_sine[(frame / 4U) & 15U] * 8;
#endif
#ifdef AUDIO_PC_STREAM
        pc_samples[frame] = mute ? 0 : (int16_t)(sample / 256);
        output = 0; /* Main I2S transmitter supplies clocks; analog DAC stays silent. */
#endif
        Audio_PackStereo24(&tx[i], mute ? 0 : output);
    }
#ifdef AUDIO_NLMS
    if (!mute) {
#ifdef AUDIO_APP_CONTROL
        Controls_BeginBlock();
#endif
        Noise_Process(primary_block, reference_block, clean_block);
#ifdef AUDIO_APP_CONTROL
        Controls_Process24(clean_block,NOISE_BLOCK);
#endif
        for (uint32_t frame = 0; frame < AUDIO_BLOCK_FRAMES; ++frame) {
            pc_samples[frame] = (int16_t)(clean_block[frame] / 256);
        }
    }
#endif
#ifdef AUDIO_PC_STREAM
    PC_Audio_Queue(pc_samples);
#endif
    __DMB(); /* Publish writes before inspecting DMA position again. */
    uint32_t elapsed = DWT->CYCCNT - started;
    if (elapsed > g_audio_stats.max_callback_cycles) {
        g_audio_stats.max_callback_cycles = elapsed;
    }
    if (elapsed >= SystemCoreClock / (AUDIO_SAMPLE_RATE / AUDIO_BLOCK_FRAMES)
        || active_half(&hdma_i2s2_ext_rx) == half
        || active_half(&hdma_i2s2_tx) == half
#ifdef AUDIO_DUAL_DATA
        || (reference_capture_running && active_half(&hdma_i2s3_rx) == half)
#endif
       ) {
        ++g_audio_stats.deadline_errors;
        Audio_Fault(AUDIO_FAULT_DEADLINE);
        return;
    }
    g_audio_stats.last_sample = previous_sample;
    if (peak > g_audio_stats.peak) { g_audio_stats.peak = peak; }
    ++g_audio_stats.rx_blocks;
    ++g_audio_stats.tx_blocks; /* TX crossed this boundary, verified by NDTR. */
}

static void half_ready(uint32_t half, uint32_t source)
{
#ifdef AUDIO_DUAL_DATA
    if (!reference_capture_running) { if (source==1U) process_half(half); return; }
    if (source == 1) ++dual_primary_events; else ++dual_reference_events;
    if (g_audio_stats.fault) { return; }
    if (ready_halves[half] & source) {
        dual_stage = 1;
        ++g_audio_stats.sync_errors;
        Audio_Fault(AUDIO_FAULT_SYNC);
        return;
    }
    ready_halves[half] |= source;
    if (ready_halves[half] != 3U) { return; }
    ready_halves[half] = 0;
#else
    (void)source;
#endif
    process_half(half);
}
#ifdef AUDIO_DUAL_DATA
void Audio_ReferenceHalfReady(uint32_t half) { half_ready(half, 2U); }
#endif
void HAL_I2SEx_TxRxHalfCpltCallback(I2S_HandleTypeDef *i2s)
{
    if (i2s == &hi2s2) { half_ready(0, 1U); }
}

void HAL_I2SEx_TxRxCpltCallback(I2S_HandleTypeDef *i2s)
{
    if (i2s == &hi2s2) { half_ready(1, 1U); }
}

void HAL_I2S_ErrorCallback(I2S_HandleTypeDef *i2s)
{
    if (i2s != &hi2s2
#ifdef AUDIO_DUAL_DATA
        && i2s != &hi2s3
#endif
       ) { return; }
    g_audio_stats.hal_error |= i2s->ErrorCode;
    if (i2s->ErrorCode & HAL_I2S_ERROR_DMA) { ++g_audio_stats.dma_errors; }
    Audio_Fault(AUDIO_FAULT_DMA);
}
