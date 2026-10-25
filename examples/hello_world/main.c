/* Standalone NUCLEO-F411RE smoke test: no downloaded libraries required.
 * PA5 = green LD2; PA2/AF7 = USART2 TX to ST-LINK's virtual COM port.
 * Reset clock: internal 16 MHz HSI. UART: 115200 baud, 8N1. */
#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(uintptr_t)(address))
#define RCC_CR        REG32(0x40023800U)
#define RCC_CFGR      REG32(0x40023808U)
#define RCC_AHB1ENR   REG32(0x40023830U)
#define RCC_APB1ENR   REG32(0x40023840U)
#define GPIOA_MODER   REG32(0x40020000U)
#define GPIOA_BSRR    REG32(0x40020018U)
#define GPIOA_AFRL    REG32(0x40020020U)
#define USART2_SR     REG32(0x40004400U)
#define USART2_DR     REG32(0x40004404U)
#define USART2_BRR    REG32(0x40004408U)
#define USART2_CR1    REG32(0x4000440CU)
#define SYSTICK_CTRL  REG32(0xE000E010U)
#define SYSTICK_LOAD  REG32(0xE000E014U)
#define SYSTICK_VAL   REG32(0xE000E018U)
#define SCB_VTOR      REG32(0xE000ED08U)

extern uint32_t _estack, _sidata, _sdata, _edata, _sbss, _ebss;
void Reset_Handler(void);
static void default_handler(void);
int main(void);
volatile uint32_t hello_count;

/* No peripheral interrupts are enabled by this test. */
__attribute__((section(".isr_vector"), used))
const uintptr_t vectors[16] = {
    (uintptr_t)&_estack, (uintptr_t)Reset_Handler,
    (uintptr_t)default_handler, (uintptr_t)default_handler,
    (uintptr_t)default_handler, (uintptr_t)default_handler,
    (uintptr_t)default_handler, 0, 0, 0, 0,
    (uintptr_t)default_handler, (uintptr_t)default_handler, 0,
    (uintptr_t)default_handler, (uintptr_t)default_handler
};

void Reset_Handler(void)
{
    uint32_t *source = &_sidata;
    for (uint32_t *dest = &_sdata; dest < &_edata;) {
        *dest++ = *source++;
    }
    for (uint32_t *dest = &_sbss; dest < &_ebss;) {
        *dest++ = 0;
    }
    SCB_VTOR = 0x08000000U;
    (void)main();
    for (;;) {}
}

static void default_handler(void)
{
    for (;;) {}
}

static void uart_write(const char *text)
{
    while (*text) {
        while ((USART2_SR & (1U << 7)) == 0) {}
        USART2_DR = (uint8_t)*text++;
    }
    while ((USART2_SR & (1U << 6)) == 0) {}
}

static void delay_ms(uint32_t milliseconds)
{
    /* Poll SysTick's 1 ms wrap flag; do not enable its interrupt. */
    SYSTICK_VAL = 0;
    while (milliseconds--) {
        while ((SYSTICK_CTRL & (1U << 16)) == 0) {}
    }
}

int main(void)
{
    RCC_CR |= 1U;
    while ((RCC_CR & (1U << 1)) == 0) {}
    RCC_CFGR &= ~3U;
    while ((RCC_CFGR & (3U << 2)) != 0) {}
    RCC_CFGR = 0; /* AHB and APB clocks = 16 MHz HSI. */

    RCC_AHB1ENR |= 1U;        /* GPIOA clock. */
    RCC_APB1ENR |= 1U << 17; /* USART2 clock. */
    (void)RCC_APB1ENR;        /* Read back after clock enable. */
    GPIOA_MODER = (GPIOA_MODER & ~((3U << 10) | (3U << 4)))
                | (1U << 10) | (2U << 4);
    GPIOA_AFRL = (GPIOA_AFRL & ~(15U << 8)) | (7U << 8);
    USART2_CR1 = 0;
    USART2_BRR = 139U; /* round(16000000 / 115200), oversampling by 16. */
    USART2_CR1 = (1U << 13) | (1U << 3); /* USART enable + TX enable. */

    SYSTICK_LOAD = 16000U - 1U;
    SYSTICK_VAL = 0;
    SYSTICK_CTRL = 5U; /* Processor clock, enabled, interrupt disabled. */

    for (;;) {
        GPIOA_BSRR = 1U << 5;
        uart_write("Hello, world! STM32F411RE is running.\r\n");
        ++hello_count;
        delay_ms(2000);
        GPIOA_BSRR = 1U << (5 + 16);
        delay_ms(2000);
    }
}
