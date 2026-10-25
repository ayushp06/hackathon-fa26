#include "audio.h"
void SysTick_Handler(void) { HAL_IncTick(); }
void DMA1_Stream3_IRQHandler(void) { HAL_DMA_IRQHandler(&hdma_i2s2_ext_rx); }
void DMA1_Stream4_IRQHandler(void) { HAL_DMA_IRQHandler(&hdma_i2s2_tx); }
/* Handle errors on both blocks; unlike HAL's generic handler this clears
 * receive overrun on I2S2ext, the actual receiver in this configuration. */
void SPI2_IRQHandler(void) { Audio_CheckI2SErrors(); }
void HardFault_Handler(void) { Audio_Fault(AUDIO_FAULT_CPU); for (;;) {} }
void MemManage_Handler(void) { Audio_Fault(AUDIO_FAULT_CPU); for (;;) {} }
void BusFault_Handler(void) { Audio_Fault(AUDIO_FAULT_CPU); for (;;) {} }
void UsageFault_Handler(void) { Audio_Fault(AUDIO_FAULT_CPU); for (;;) {} }
