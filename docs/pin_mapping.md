# AURA pin mapping

These are **NUCLEO-F411RE MCU and ST morpho header pins**, not breakout-header pin numbers. The IC-level assignments come from the [STM32F411RE datasheet AF table](https://www.st.com/resource/en/datasheet/stm32f411re.pdf); CN7/CN10 positions come from [UM1724 Table 29](https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo-32-boards-stmicroelectronics.pdf).

| Function | STM32 pin / AF | Nucleo header | Destination |
| --- | --- | --- | --- |
| Shared WS / LRCK | PB12 / AF5 I2S2_WS | CN10-16 | INMP441 WS; PCM5102A LRCK |
| Shared BCK / SCK | PB13 / AF5 I2S2_CK | CN10-30 | INMP441 SCK; PCM5102A BCK |
| Microphone data in | PB14 / **AF6** I2S2ext_SD | CN10-28 | INMP441 SD |
| DAC data out | PB15 / AF5 I2S2_SD | CN10-26 | PCM5102A DIN |
| Encoder A | PA0 / GPIO or TIM2_CH1 | CN7-28 | Encoder A, 3.3 V logic |
| Encoder B | PA1 / GPIO or TIM2_CH2 | CN7-30 | Encoder B, 3.3 V logic |
| Encoder push | PA4 / GPIO | CN7-32 | Momentary switch to GND |
| Additional button 1 | PB0 / GPIO | CN7-34 | Momentary switch to GND |
| Additional button 2 | PB1 / GPIO | CN10-24 | Momentary switch to GND |
| Amplifier enable | PA8 / GPIO | CN10-23 | MAX97220 SHDN, active low |
| Regulated 3.3 V | Board rail | CN7-16 | IC supplies, after power budget check |
| Ground | Board ground | CN7-20 or CN10-20 | Common signal/power ground |

PB14 must use AF6 for the **extended** receiver; AF5 on PB14 is SPI2_MISO, not I2S2ext_SD. I2S2 master TX uses PB15. There is no I²S MCLK pin in this plan. The four I²S pins are exposed on CN10 without solder-bridge changes shown in UM1724 Table 29. [STM32F411RE datasheet, alternate-function table](https://www.st.com/resource/en/datasheet/stm32f411re.pdf), [ST RM0383 §20.4.2](https://www.st.com/resource/en/reference_manual/dm00119316.pdf)

Use pullups to 3.3 V and switch-to-ground wiring for the five user inputs, with contact debounce. Internal MCU pullups may suffice for a short prototype harness; switch module circuitry and cable length must be checked. Keep the amplifier's SHDN held low during reset/power ramp with an external pulldown, then drive PA8 high only after the audio path is stable. This avoids an undefined output during MCU boot. The chosen controls avoid PB12–PB15, PA13/PA14 SWD, PA2/PA3 virtual COM port, PA5 user LED, and PC13 user button. [ST UM1724 Tables 16, 29](https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo-32-boards-stmicroelectronics.pdf), [ADI MAX97220 pin description](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf)

## IC pins that are not MCU GPIOs

| Bare IC | Required connection | Source |
| --- | --- | --- |
| INMP441 | SCK 1, SD 2, WS 3, L/R 4 to GND, GND 5/6/9, VDD 7 to 3.3 V, CHIPEN 8 to 3.3 V | [TDK pin table](https://product.tdk.com/system/files/dam/doc/product/sw_piezo/mic/mems-mic/data_sheet/inmp441.pdf) |
| PCM5102A | CPVDD 1, CAPP 2, CPGND 3, CAPM 4, VNEG 5, OUTL 6, OUTR 7, AVDD 8, AGND 9, DEMP 10, FLT 11, SCK 12 to GND, BCK 13, DIN 14, LRCK 15, FMT 16 low, XSMT 17 high for playback, LDOO 18 decoupled, DGND 19, DVDD 20 | [TI pin table](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf) |
| MAX97220 | PVDD 1, C1P 2, PGND 3, C1N 4, PVSS 5, SGND 6, INR+ 7, INR− 8, SVDD2 9, OUTR 10, BIAS 11, OUTL 12, SVDD 13, INL− 14, INL+ 15, SHDN 16 | [ADI pin table](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf) |

These package numbers must **not** be used as pin numbers for an unspecified microphone, DAC, amplifier, or jack breakout. Confirm each purchased module's schematic and orientation first.
