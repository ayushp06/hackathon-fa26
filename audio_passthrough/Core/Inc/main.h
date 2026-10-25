#ifndef AUDIO_MAIN_H
#define AUDIO_MAIN_H
#include "stm32f4xx_hal.h"
extern I2S_HandleTypeDef hi2s2;
extern DMA_HandleTypeDef hdma_i2s2_ext_rx;
extern DMA_HandleTypeDef hdma_i2s2_tx;
extern UART_HandleTypeDef huart2;
void Error_Handler(void);
#endif
