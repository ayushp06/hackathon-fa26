# AURA hardware architecture

Status: a bare-IC KiCad schematic is available and reviewed in [electrical_review.md](electrical_review.md). Physical modules, power budget, and listening-level validation remain blocked as listed in [open_questions.md](open_questions.md).

## Signal and clock path

`INMP441 SD → PB14 / I2S2_ext RX → STM32F411 processing → PB15 / I2S2 TX → PCM5102A OUTL/OUTR → MAX97220 → stereo 3.5 mm jack → wired earbuds`

The STM32 is the sole I²S master. PB12 supplies WS/LRCK to the microphone and DAC; PB13 supplies SCK/BCK to both. Configure SPI2/I2S2 as **master transmit**, with its internally synchronized I2S2_ext as **slave receive**. The main and extended blocks exchange data on separate pins while sharing the same frame clocks. Do not try to operate two independent I²S masters on this bus. ST describes this pairing in RM0383 §20.4.2. [ST RM0383](https://www.st.com/resource/en/reference_manual/dm00119316.pdf)

| Parameter | Architecture target | Basis |
| --- | --- | --- |
| WS/LRCK | 16,000 frames/s | Requested target; within both audio IC ranges |
| BCK/SCK | 1.024 MHz = 16,000 × 64 | Two 32-bit slots per frame |
| Input | One 24-bit signed INMP441 word in the selected left slot; right slot unused | The microphone requires 64 clocks per stereo frame and drives only its chosen slot |
| Output | Two 24-bit signed PCM words in 32-bit left/right slots | The DAC accepts 24-bit I²S; duplicate or separately process mono input for L/R |
| MCLK | None to DAC | PCM5102A uses its BCK PLL when SCK is held low |

The INMP441 L/R pin is held low for the left slot and CHIPEN high to enable it. Its inactive slot is high impedance; provide the datasheet's 100 kΩ SD pulldown. The PCM5102A SCK pin is **grounded**, not left floating, for three-wire operation. At 16 kHz and 64 BCK per frame, its specified PLL table explicitly permits 1.024 MHz BCK. Tie FMT low for I²S. [TDK INMP441 datasheet](https://product.tdk.com/system/files/dam/doc/product/sw_piezo/mic/mems-mic/data_sheet/inmp441.pdf), [TI PCM5102A datasheet §§9.3.5.3, 10.1.1](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf)

The STM32 I²S data register is 16 bits wide even for 24-bit audio, so each 32-bit slot is transferred as two 16-bit words. DMA buffers must preserve left/right order and the I²S one-bit delay. The audio PLL and I²S prescaler must be selected for nominal 16 kHz, then WS and BCK measured on the actual board; no unverified clock register recipe is frozen here. [ST RM0383 §20.4](https://www.st.com/resource/en/reference_manual/dm00119316.pdf)

DMA1 has separate, nonconflicting requests: I2S2_ext RX is **Stream 3, Channel 3**; SPI2/I2S2 TX is **Stream 4, Channel 0** (RM0383 Table 27). Both directions can therefore use circular DMA with shared clocks. Buffer depth, clock accuracy, DMA underrun behavior, and acoustic latency need bench validation before the device is called real time. The DAC's normal filter latency is 20 sample periods; its low-latency mode is 3.5 sample periods, selected by FLT. [ST RM0383 Table 27](https://www.st.com/resource/en/reference_manual/dm00119316.pdf), [TI PCM5102A datasheet §§6, 7](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf)

At 16 kHz, the INMP441's specified digital-filter group delay is about **1.08 ms**. The DAC adds about **1.25 ms** in normal filter mode or **0.22 ms** in low-latency mode, before DMA buffering and processing. The microphone passband extends to 0.423 × fs, about **6.77 kHz** at this sample rate. These are datasheet-derived figures, not a system latency measurement. [TDK INMP441 datasheet Tables 1 and 7, digital filter section](https://product.tdk.com/system/files/dam/doc/product/sw_piezo/mic/mems-mic/data_sheet/inmp441.pdf), [TI PCM5102A datasheet §6](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf)

## Analog path and listening level

The PCM5102A OUTL and OUTR pins are **single-ended, ground-centered line outputs**, up to 2.1 V RMS at full scale. MAX97220 inputs are differential, but its datasheet explicitly supports a **pseudo-differential** connection for a single-ended codec: each DAC output feeds its channel's signal input through the selected input network, while the corresponding reference input is taken from quiet signal ground through the matching network. The exact resistor/capacitor network depends on the MAX97220 suffix and module implementation; it is not interchangeable with a bare-wire connection. The A/B/E variants require external gain resistors; C/D have fixed +6 dB gain. [TI PCM5102A datasheet §§6, 10](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf), [ADI MAX97220 datasheet pp. 11–13](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf)

The amplifier has ground-referenced OUTL/OUTR, so the jack's two earbud returns connect to system ground; **do not bridge either output to an amplifier input or charge-pump node**. A physical jack advertised as “Teensy-compatible” does not establish contact numbering. Verify its actual datasheet for tip, ring, sleeve and switch contacts before wiring. The high possible output level requires a hardware gain choice and measured safe maximum level, with muted startup and shutdown. No unmeasured full-scale signal should be applied to earbuds. [ADI MAX97220 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf)

## USB power concept

Use the Nucleo ST-LINK USB connector CN1 as the prototype power input, JP5 on U5V (pins 1–2), and the board's regulated +3.3 V at CN7 pin 16 for **3.3 V IC rails only**, subject to a measured total-current and regulator budget. ST limits the board plus extensions to 300 mA with JP1 removed, or 100 mA with JP1 fitted; a charger without USB enumeration needs JP1 fitted and the 100 mA budget. Do not feed 5 V to the INMP441 or PCM5102A. Keep analog supply routing and local decoupling separate from I²S return currents while using a common ground plane. If the board 3.3 V rail cannot meet load/noise requirements, add a specified low-noise 3.3 V regulator from U5V after its current budget is resolved; do not parallel regulators. [ST UM1724 §§7.5, Table 29](https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo-32-boards-stmicroelectronics.pdf), [TDK INMP441 datasheet](https://product.tdk.com/system/files/dam/doc/product/sw_piezo/mic/mems-mic/data_sheet/inmp441.pdf), [TI PCM5102A datasheet §11](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf)

Provide local capacitors specified in [component_requirements.md](component_requirements.md), keep the microphone supply clean, and place amplifier charge-pump capacitors at its pins. The MAX97220 operates from 2.5–5.5 V, so 3.3 V is valid, but output capability into the chosen earbuds must be checked at that voltage. [ADI MAX97220 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf)
