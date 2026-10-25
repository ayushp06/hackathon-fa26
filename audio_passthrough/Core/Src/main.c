#include "main.h"
#include "audio.h"
#include "pc_audio.h"
#include "reference_capture.h"
#ifdef AUDIO_ADAPTIVE_ML
#include "adaptive_audio.h"
#include "audio_controls.h"
#endif
#include <stdio.h>
#include <string.h>

I2S_HandleTypeDef hi2s2;
DMA_HandleTypeDef hdma_i2s2_ext_rx;
DMA_HandleTypeDef hdma_i2s2_tx;
UART_HandleTypeDef huart2;
static void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_DMA_Init(void);
static void MX_I2S2_Init(void);
static void MX_USART2_UART_Init(void);

/* Foreground only. Audio DMA interrupts remain enabled during UART polling. */
static void debug_write(const char *text)
{
#ifdef AUDIO_PC_STREAM
    (void)text; /* Binary PCM transport must never be mixed with text. */
#else
    (void)HAL_UART_Transmit(&huart2, (const uint8_t *)text,
                            (uint16_t)strlen(text), 100);
#endif
}

#ifdef AUDIO_PIN_PROBE
/* Optional foreground diagnosis when no scope is available. This reads the
 * actual GPIO pads with I2S running. Interrupts stay enabled throughout.
 * Counts show activity, not calibrated frequency or electrical integrity. */
static void debug_pin_probe(void)
{
    uint32_t saved_pull = GPIOB->PUPDR;
    for (uint32_t pull_up = 0; pull_up < 2U; ++pull_up) {
        MODIFY_REG(GPIOB->PUPDR, 3U << 28, (pull_up ? 1U : 2U) << 28);
        __DSB();
        for (volatile uint32_t settle = 0; settle < 1000U; ++settle) {}
        uint32_t previous = GPIOB->IDR;
        uint32_t bck_edges = 0, ws_edges = 0, sd_edges = 0, sd_high = 0, dac_edges = 0;
        for (uint32_t i = 0; i < 100000U; ++i) {
            uint32_t pins = GPIOB->IDR;
            uint32_t changed = pins ^ previous;
            bck_edges += (changed >> 13) & 1U;
            ws_edges += (changed >> 12) & 1U;
            sd_edges += (changed >> 14) & 1U;
            sd_high += (pins >> 14) & 1U;
            dac_edges += (changed >> 15) & 1U;
            previous = pins;
        }
        char line[160];
        (void)snprintf(line, sizeof line,
            "PIN PROBE pull=%s reads=100000 bck_edges=%lu ws_edges=%lu sd_edges=%lu sd_high=%lu dac_edges=%lu\r\n",
            pull_up ? "UP" : "DOWN", (unsigned long)bck_edges,
            (unsigned long)ws_edges, (unsigned long)sd_edges, (unsigned long)sd_high,
            (unsigned long)dac_edges);
        debug_write(line);
    }
    GPIOB->PUPDR = saved_pull;
}
#endif

int main(void)
{
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();
    MX_USART2_UART_Init();
#ifdef AUDIO_PC_STREAM
    PC_Audio_Init();
#endif
    debug_write("\r\nINMP441 -> I2S2 full duplex -> PCM5102A\r\n");
    MX_DMA_Init();
    MX_I2S2_Init();
#ifdef AUDIO_DUAL_DATA
    Reference_Init();
#endif
    g_audio_stats.i2s_initialized = 1;
    debug_write("I2S init OK: PB14 AF6 RX, PB15 AF5 TX, 16000 Hz, 24/32\r\n");

    CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
    DWT->CYCCNT = 0;
    DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;
    if (Audio_Start() != HAL_OK) { Error_Handler(); }
#ifdef AUDIO_DUAL_DATA
    Reference_ProbeClocks();
#endif
    debug_write("RX+TX circular DMA started; mono duplicated L/R, gain 1/1\r\n");
#ifdef AUDIO_DAC_TEST_TONE
    debug_write("DAC TEST: continuous -30 dBFS 250 Hz tone; microphone output replaced\r\n");
#endif
    char config_line[180];
    (void)snprintf(config_line, sizeof config_line,
        "GPIOB MODER=0x%08lx AFRH=0x%08lx PUPDR=0x%08lx "
        "I2S TX=0x%04lx RX=0x%04lx DIV=0x%04lx CLK=%lu\r\n",
        (unsigned long)GPIOB->MODER, (unsigned long)GPIOB->AFR[1],
        (unsigned long)GPIOB->PUPDR, (unsigned long)SPI2->I2SCFGR,
        (unsigned long)I2S2ext->I2SCFGR, (unsigned long)SPI2->I2SPR,
        (unsigned long)HAL_RCCEx_GetPeriphCLKFreq(RCC_PERIPHCLK_I2S));
    debug_write(config_line);

    uint32_t last_report = HAL_GetTick();
    uint32_t last_led = last_report;
    uint32_t last_progress = last_report;
    uint32_t last_blocks = 0;
    uint32_t stopped = 0;
#ifdef AUDIO_PIN_PROBE
    uint32_t probed = 0;
    uint32_t probe_start = last_report;
#endif
    for (;;) {
        uint32_t now = HAL_GetTick();
#ifdef AUDIO_PC_STREAM
        PC_Audio_Poll();
#endif
#ifdef AUDIO_ADAPTIVE_ML
        Adaptive_Poll(now,!g_audio_stats.fault && !g_control_stats.spatial);
#endif
#ifdef AUDIO_PIN_PROBE
        if (!probed && now - probe_start >= 500U) {
            probed = 1;
            debug_pin_probe();
        }
#endif
        if (g_audio_stats.rx_blocks != last_blocks) {
            last_blocks = g_audio_stats.rx_blocks;
            last_progress = now;
        } else if (!g_audio_stats.fault && (now - last_progress > 100U)) {
            ++g_audio_stats.stalls;
            Audio_Fault(AUDIO_FAULT_STALL);
        }
        if (g_audio_stats.fault && !stopped) {
#ifdef AUDIO_PC_STREAM
            PC_Audio_ReportFault();
#endif
            (void)HAL_I2S_DMAStop(&hi2s2);
#ifdef AUDIO_DUAL_DATA
            (void)HAL_I2S_DMAStop(&hi2s3);
#endif
            HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);
            debug_write("FAULT: stream stopped. Fix cause and reset; see counters.\r\n");
            stopped = 1;
        }
        if (now - last_report >= AUDIO_REPORT_INTERVAL_MS) {
            last_report = now;
#ifdef AUDIO_PC_STREAM
            if (g_audio_stats.fault) PC_Audio_ReportFault();
#endif
            AudioStats stats;
            uint32_t mask = __get_PRIMASK();
            __disable_irq();
            stats = g_audio_stats;
            g_audio_stats.peak = 0; /* Start a fresh monitor peak window. */
            __set_PRIMASK(mask);
            char line[320];
            (void)snprintf(line, sizeof line,
                "rx=%lu tx=%lu nz=%lu rnz=%lu change=%lu sample=%ld peak=%lu clip=%lu "
                "cycles=%lu sync=%lu late=%lu dma=%lu ovr=%lu udr=%lu fre=%lu "
                "stall=%lu hal=0x%lx fault=%lu ndtr=%lu/%lu\r\n",
                (unsigned long)stats.rx_blocks, (unsigned long)stats.tx_blocks,
                (unsigned long)stats.nonzero_samples, (unsigned long)stats.right_nonzero_samples,
                (unsigned long)stats.changing_samples,
                (long)stats.last_sample, (unsigned long)stats.peak,
                (unsigned long)stats.clipped_samples, (unsigned long)stats.max_callback_cycles,
                (unsigned long)stats.sync_errors, (unsigned long)stats.deadline_errors,
                (unsigned long)stats.dma_errors, (unsigned long)stats.overruns,
                (unsigned long)stats.underruns, (unsigned long)stats.frame_errors,
                (unsigned long)stats.stalls, (unsigned long)stats.hal_error,
                (unsigned long)stats.fault,
                (unsigned long)__HAL_DMA_GET_COUNTER(&hdma_i2s2_ext_rx),
                (unsigned long)__HAL_DMA_GET_COUNTER(&hdma_i2s2_tx));
            debug_write(line);
            if (!stats.fault && now - last_led >= 1000U) {
                last_led = now;
                HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
            }
        }
        __WFI();
    }
}

static void SystemClock_Config(void)
{
    RCC_OscInitTypeDef osc = {0};
    RCC_ClkInitTypeDef clk = {0};
    RCC_PeriphCLKInitTypeDef audio_clk = {0};
    __HAL_RCC_PWR_CLK_ENABLE();
    __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);
    osc.OscillatorType = RCC_OSCILLATORTYPE_HSI;
    osc.HSIState = RCC_HSI_ON;
    osc.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
    osc.PLL.PLLState = RCC_PLL_ON;
    osc.PLL.PLLSource = RCC_PLLSOURCE_HSI;
    osc.PLL.PLLM = 16;
    osc.PLL.PLLN = 192;
    osc.PLL.PLLP = RCC_PLLP_DIV2;
    osc.PLL.PLLQ = 4;
    if (HAL_RCC_OscConfig(&osc) != HAL_OK) { Error_Handler(); }
    clk.ClockType = RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK
                  | RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    clk.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    clk.AHBCLKDivider = RCC_SYSCLK_DIV1;
    clk.APB1CLKDivider = RCC_HCLK_DIV2;
    clk.APB2CLKDivider = RCC_HCLK_DIV1;
    if (HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_3) != HAL_OK) { Error_Handler(); }

    /* F411 has its own PLLI2SM divider: 16 MHz / 16 * 256 / 5 = 51.2 MHz.
     * MCLK off, 64 clocks/frame, I2SDIV=25, ODD=0 => nominal 16000 Hz.
     * Absolute accuracy follows the internal HSI tolerance. */
    audio_clk.PeriphClockSelection = RCC_PERIPHCLK_I2S;
    audio_clk.PLLI2S.PLLI2SM = 16;
    audio_clk.PLLI2S.PLLI2SN = 256;
    audio_clk.PLLI2S.PLLI2SR = 5;
    if (HAL_RCCEx_PeriphCLKConfig(&audio_clk) != HAL_OK) { Error_Handler(); }
}

static void MX_GPIO_Init(void)
{
    __HAL_RCC_GPIOA_CLK_ENABLE();
    GPIO_InitTypeDef gpio = {0};
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);
    gpio.Pin = GPIO_PIN_5;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Pull = GPIO_NOPULL;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOA, &gpio);
}

static void MX_DMA_Init(void)
{
    __HAL_RCC_DMA1_CLK_ENABLE();
    HAL_NVIC_SetPriority(DMA1_Stream3_IRQn, 1, 0);
    HAL_NVIC_EnableIRQ(DMA1_Stream3_IRQn);
    HAL_NVIC_SetPriority(DMA1_Stream4_IRQn, 1, 0);
    HAL_NVIC_EnableIRQ(DMA1_Stream4_IRQn);
}

static void MX_I2S2_Init(void)
{
    hi2s2.Instance = SPI2;
    hi2s2.Init.Mode = I2S_MODE_MASTER_TX;
    hi2s2.Init.Standard = I2S_STANDARD_PHILIPS;
    hi2s2.Init.DataFormat = I2S_DATAFORMAT_24B;
    hi2s2.Init.MCLKOutput = I2S_MCLKOUTPUT_DISABLE;
    hi2s2.Init.AudioFreq = I2S_AUDIOFREQ_16K;
    hi2s2.Init.CPOL = I2S_CPOL_LOW;
    hi2s2.Init.ClockSource = I2S_CLOCK_PLL;
    hi2s2.Init.FullDuplexMode = I2S_FULLDUPLEXMODE_ENABLE;
    if (HAL_I2S_Init(&hi2s2) != HAL_OK) { Error_Handler(); }
    if ((SPI2->I2SPR & (SPI_I2SPR_I2SDIV | SPI_I2SPR_ODD | SPI_I2SPR_MCKOE)) != 25U) {
        Error_Handler();
    }
}

static void MX_USART2_UART_Init(void)
{
    huart2.Instance = USART2;
#ifdef AUDIO_PC_STREAM
    huart2.Init.BaudRate = 921600;
#else
    huart2.Init.BaudRate = 115200;
#endif
    huart2.Init.WordLength = UART_WORDLENGTH_8B;
    huart2.Init.StopBits = UART_STOPBITS_1;
    huart2.Init.Parity = UART_PARITY_NONE;
    huart2.Init.Mode = UART_MODE_TX_RX;
    huart2.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    huart2.Init.OverSampling = UART_OVERSAMPLING_16;
    if (HAL_UART_Init(&huart2) != HAL_OK) { Error_Handler(); }
}

void Error_Handler(void)
{
    Audio_Fault(AUDIO_FAULT_INIT);
#ifdef AUDIO_PC_STREAM
    if (huart2.Instance == USART2 && huart2.gState == HAL_UART_STATE_READY) {
        PC_Audio_ReportFault();
    }
#endif
    if (huart2.Instance == USART2 && huart2.gState == HAL_UART_STATE_READY) {
        debug_write("FATAL: peripheral initialization/start failed; inspect g_audio_stats.\r\n");
    }
    uint32_t fault_report_tick=HAL_GetTick();
    for (;;) {
#ifdef AUDIO_PC_STREAM
        if (huart2.Instance==USART2) {
            PC_Audio_Poll();
            if (HAL_GetTick()-fault_report_tick>=100U) {
                fault_report_tick=HAL_GetTick(); PC_Audio_ReportFault();
            }
        }
#endif
    }
}
