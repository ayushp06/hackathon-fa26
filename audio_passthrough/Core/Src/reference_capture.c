#include "reference_capture.h"
#ifdef AUDIO_DUAL_DATA
#include <string.h>
I2S_HandleTypeDef hi2s3;
DMA_HandleTypeDef hdma_i2s3_rx;
uint16_t reference_rx[AUDIO_RING_WORDS] __attribute__((aligned(4)));
volatile uint32_t reference_capture_running;
volatile uint32_t dual_primary_events, dual_reference_events, dual_stage, dual_clock_flags;
volatile uint32_t dual_fault_words[4];

void Reference_ProbeClocks(void)
{
    uint32_t previous_b = GPIOB->IDR, previous_c = GPIOC->IDR, previous_a = GPIOA->IDR;
    uint32_t changes_b = 0, changes_c = 0, changes_a = 0;
    for (uint32_t i = 0; i < 6000U; ++i) {
        uint32_t b = GPIOB->IDR, c = GPIOC->IDR, a = GPIOA->IDR;
        changes_b |= b ^ previous_b; changes_c |= c ^ previous_c; changes_a |= a ^ previous_a;
        previous_b = b; previous_c = c; previous_a = a;
    }
    dual_clock_flags = ((changes_b & GPIO_PIN_13) ? 1U : 0U)
        | ((changes_c & GPIO_PIN_10) ? 2U : 0U)
        | ((changes_b & GPIO_PIN_12) ? 4U : 0U)
        | ((changes_a & GPIO_PIN_4) ? 8U : 0U);
}

void Reference_Init(void)
{
    __HAL_RCC_SPI3_CLK_ENABLE();
    __HAL_RCC_GPIOC_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_DMA1_CLK_ENABLE();
    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = GPIO_PIN_10 | GPIO_PIN_12;
    gpio.Mode = GPIO_MODE_AF_PP;
    gpio.Pull = GPIO_PULLDOWN;
    gpio.Speed = GPIO_SPEED_FREQ_HIGH;
    gpio.Alternate = GPIO_AF6_SPI3;
    HAL_GPIO_Init(GPIOC, &gpio);
    gpio.Pin = GPIO_PIN_4;
    HAL_GPIO_Init(GPIOA, &gpio);

    hdma_i2s3_rx.Instance = DMA1_Stream0;
    hdma_i2s3_rx.Init.Channel = DMA_CHANNEL_0;
    hdma_i2s3_rx.Init.Direction = DMA_PERIPH_TO_MEMORY;
    hdma_i2s3_rx.Init.PeriphInc = DMA_PINC_DISABLE;
    hdma_i2s3_rx.Init.MemInc = DMA_MINC_ENABLE;
    hdma_i2s3_rx.Init.PeriphDataAlignment = DMA_PDATAALIGN_HALFWORD;
    hdma_i2s3_rx.Init.MemDataAlignment = DMA_MDATAALIGN_HALFWORD;
    hdma_i2s3_rx.Init.Mode = DMA_CIRCULAR;
    hdma_i2s3_rx.Init.Priority = DMA_PRIORITY_VERY_HIGH;
    hdma_i2s3_rx.Init.FIFOMode = DMA_FIFOMODE_DISABLE;
    hdma_i2s3_rx.Init.MemBurst = DMA_MBURST_SINGLE;
    hdma_i2s3_rx.Init.PeriphBurst = DMA_PBURST_SINGLE;
    if (HAL_DMA_Init(&hdma_i2s3_rx) != HAL_OK) { Error_Handler(); }

    hi2s3.Instance = SPI3;
    hi2s3.Init.Mode = I2S_MODE_SLAVE_RX;
    hi2s3.Init.Standard = I2S_STANDARD_PHILIPS;
    hi2s3.Init.DataFormat = I2S_DATAFORMAT_24B;
    hi2s3.Init.MCLKOutput = I2S_MCLKOUTPUT_DISABLE;
    hi2s3.Init.AudioFreq = I2S_AUDIOFREQ_16K;
    hi2s3.Init.CPOL = I2S_CPOL_LOW;
    hi2s3.Init.ClockSource = I2S_CLOCK_PLL;
    hi2s3.Init.FullDuplexMode = I2S_FULLDUPLEXMODE_DISABLE;
    __HAL_LINKDMA(&hi2s3, hdmarx, hdma_i2s3_rx);
    /* GPIO/DMA setup is explicit here; the existing MSP hook handles SPI2. */
    if (HAL_I2S_Init(&hi2s3) != HAL_OK) { Error_Handler(); }
    HAL_NVIC_SetPriority(DMA1_Stream0_IRQn, 1, 0);
    HAL_NVIC_EnableIRQ(DMA1_Stream0_IRQn);
    HAL_NVIC_SetPriority(SPI3_IRQn, 0, 0);
    HAL_NVIC_EnableIRQ(SPI3_IRQn);
}

HAL_StatusTypeDef Reference_Start(void)
{
    memset(reference_rx, 0, sizeof reference_rx);
    /* RM0383: enable a Philips slave while WS is high. Wait for a complete
     * low-to-high edge from the running master, leaving a full right slot
     * for HAL to arm DMA before the next left sample begins. */
    uint32_t start = HAL_GetTick();
    while (GPIOA->IDR & GPIO_PIN_4) {
        if (HAL_GetTick() - start > 2U) return HAL_TIMEOUT;
    }
    while (!(GPIOA->IDR & GPIO_PIN_4)) {
        if (HAL_GetTick() - start > 2U) return HAL_TIMEOUT;
    }
    HAL_StatusTypeDef status = HAL_I2S_Receive_DMA(&hi2s3, reference_rx, AUDIO_RING_FRAMES * 2U);
    if (status != HAL_OK || hdma_i2s3_rx.ErrorCode
        || !(hdma_i2s3_rx.Instance->CR & DMA_SxCR_EN)) { return HAL_ERROR; }
    reference_capture_running=1;
    return HAL_OK;
}
void HAL_I2S_RxHalfCpltCallback(I2S_HandleTypeDef *i2s)
{
    if (i2s == &hi2s3) { Audio_ReferenceHalfReady(0); }
}
void HAL_I2S_RxCpltCallback(I2S_HandleTypeDef *i2s)
{
    if (i2s == &hi2s3) { Audio_ReferenceHalfReady(1); }
}
void DMA1_Stream0_IRQHandler(void) { HAL_DMA_IRQHandler(&hdma_i2s3_rx); }
void SPI3_IRQHandler(void) { Audio_CheckI2SErrors(); }
#endif
