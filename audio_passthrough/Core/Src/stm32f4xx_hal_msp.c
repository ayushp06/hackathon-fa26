#include "main.h"

void HAL_MspInit(void)
{
    __HAL_RCC_SYSCFG_CLK_ENABLE();
    __HAL_RCC_PWR_CLK_ENABLE();
    HAL_NVIC_SetPriorityGrouping(NVIC_PRIORITYGROUP_4);
}

void HAL_I2S_MspInit(I2S_HandleTypeDef *hi2s)
{
    if (hi2s->Instance != SPI2) { return; }
    __HAL_RCC_SPI2_CLK_ENABLE();
    __HAL_RCC_GPIOB_CLK_ENABLE();
    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = GPIO_PIN_12 | GPIO_PIN_13 | GPIO_PIN_15;
    gpio.Mode = GPIO_MODE_AF_PP;
    gpio.Pull = GPIO_NOPULL;
    gpio.Speed = GPIO_SPEED_FREQ_HIGH;
    gpio.Alternate = GPIO_AF5_SPI2;
    HAL_GPIO_Init(GPIOB, &gpio);
    gpio.Pin = GPIO_PIN_14;
    gpio.Pull = GPIO_PULLDOWN; /* Mic releases SD during unused slot/padding. */
    gpio.Alternate = GPIO_AF6_I2S2ext;
    HAL_GPIO_Init(GPIOB, &gpio);

    hdma_i2s2_ext_rx.Instance = DMA1_Stream3;
    hdma_i2s2_ext_rx.Init.Channel = DMA_CHANNEL_3;
    hdma_i2s2_ext_rx.Init.Direction = DMA_PERIPH_TO_MEMORY;
    hdma_i2s2_ext_rx.Init.PeriphInc = DMA_PINC_DISABLE;
    hdma_i2s2_ext_rx.Init.MemInc = DMA_MINC_ENABLE;
    hdma_i2s2_ext_rx.Init.PeriphDataAlignment = DMA_PDATAALIGN_HALFWORD;
    hdma_i2s2_ext_rx.Init.MemDataAlignment = DMA_MDATAALIGN_HALFWORD;
    hdma_i2s2_ext_rx.Init.Mode = DMA_CIRCULAR;
    hdma_i2s2_ext_rx.Init.Priority = DMA_PRIORITY_VERY_HIGH;
    hdma_i2s2_ext_rx.Init.FIFOMode = DMA_FIFOMODE_DISABLE;
    hdma_i2s2_ext_rx.Init.MemBurst = DMA_MBURST_SINGLE;
    hdma_i2s2_ext_rx.Init.PeriphBurst = DMA_PBURST_SINGLE;
    if (HAL_DMA_Init(&hdma_i2s2_ext_rx) != HAL_OK) { Error_Handler(); }
    __HAL_LINKDMA(hi2s, hdmarx, hdma_i2s2_ext_rx);

    hdma_i2s2_tx.Instance = DMA1_Stream4;
    hdma_i2s2_tx.Init = hdma_i2s2_ext_rx.Init;
    hdma_i2s2_tx.Init.Channel = DMA_CHANNEL_0;
    hdma_i2s2_tx.Init.Direction = DMA_MEMORY_TO_PERIPH;
    if (HAL_DMA_Init(&hdma_i2s2_tx) != HAL_OK) { Error_Handler(); }
    __HAL_LINKDMA(hi2s, hdmatx, hdma_i2s2_tx);

    HAL_NVIC_SetPriority(SPI2_IRQn, 0, 0);
    HAL_NVIC_EnableIRQ(SPI2_IRQn);
}

void HAL_UART_MspInit(UART_HandleTypeDef *uart)
{
    if (uart->Instance != USART2) { return; }
    __HAL_RCC_USART2_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();
    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = GPIO_PIN_2 | GPIO_PIN_3;
    gpio.Mode = GPIO_MODE_AF_PP;
    gpio.Pull = GPIO_PULLUP;
    gpio.Speed = GPIO_SPEED_FREQ_HIGH;
    gpio.Alternate = GPIO_AF7_USART2;
    HAL_GPIO_Init(GPIOA, &gpio);
}
