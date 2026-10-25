#include "stm32f4xx.h"
#include "dsp_demo.h"

int main(void)
{
    /* ST SystemInit enables the FPU; use the reset 16 MHz HSI clock.
     * No board-specific pins or external oscillator are required. */
    SystemCoreClockUpdate();
    dsp_demo_run();

    for (;;) {
        __WFI();
    }
}
