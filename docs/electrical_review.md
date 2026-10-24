# AURA electrical design review

**Review date:** 2026-10-22. **Overall status: NO-GO for physical assembly with unidentified modules or for listener use.** The KiCad schematic is electrically coherent at the **bare-IC and specified-jack** level; a clean ERC is not proof that unselected parts, wiring, supply capacity, or acoustic output are safe.

A separate [documented-module breadboard schematic](../hardware/AURA_breadboard.kicad_sch) and [pad-label wire list](breadboard_wiring.md) were added. Its external connections pass ERC with zero violations; its board internals, amplifier jumper side, supply margin, and actual output still require physical verification. The BOM below this review remains for the bare-IC design.

## Scope and evidence

Reviewed `hardware/AURA.kicad_sch`, its project-local symbols/footprint, all existing `docs/` files, KiCad 9.0.8 ERC, the exported 29-net netlist, and the schematic PDF. These sources govern the design:

- [ST STM32F411RE datasheet, alternate-function table](https://www.st.com/resource/en/datasheet/stm32f411re.pdf); [ST RM0383, I²S and DMA request mapping](https://www.st.com/resource/en/reference_manual/dm00119316.pdf); [ST UM1724, Nucleo power and CN7/CN10 Table 29](https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo-32-boards-stmicroelectronics.pdf).
- [TDK INMP441 datasheet, pins and timing](https://product.tdk.com/system/files/dam/doc/product/sw_piezo/mic/mems-mic/data_sheet/inmp441.pdf); [TI PCM5102A datasheet, pins, 3-wire PLL, and Figure 33](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf).
- [ADI MAX97220A–E datasheet, pin table and pseudo-differential application circuit](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf); [Same Sky SJ-352X-SMT datasheet, contact numbering](https://www.mouser.com/datasheet/2/1628/sj_352x_smt-3511282.pdf).

## ERC and netlist result

KiCad ERC found **0 errors and 0 warnings** after correction; see [AURA_erc.rpt](../hardware/exports/AURA_erc.rpt). The exported [AURA_netlist.net](../hardware/exports/AURA_netlist.net) has 29 named nets. A net-by-net check found no direct V3V3–GND short, no DAC OUTL/OUTR short, no HP_L/HP_R short, and no charge-pump capacitor tied to the wrong net. The schematic uses actual labeled electrical nets. NC markers on unused Nucleo connector contacts mean no AURA external connection; they do not imply those MCU or board pins are physically absent.

**Correction made:** added C14 (100 nF), C15 (100 nF), and C16 (10 µF), completing local 100 nF/10 µF pairs for PCM5102A DVDD, CPVDD, and AVDD as drawn in TI Figure 33. Added TP9/TP10 for DAC line outputs and TP11 for amplifier SHDN so the bring-up measurements can be made without probing IC leads. The rail is still one V3V3 net, so the physical placement requirement in the wiring guide is essential. ERC was rerun after these changes.

## Connection review

| Area | Verified schematic connection and finding |
| --- | --- |
| Nucleo headers / alternate functions | CN10-16 PB12 AF5 = I2S2_WS; CN10-30 PB13 AF5 = I2S2_CK; CN10-28 PB14 **AF6** = I2S2ext_SD RX; CN10-26 PB15 AF5 = I2S2_SD TX. CN7-28 PA0, CN7-30 PA1, CN7-32 PA4, CN7-34 PB0, CN10-24 PB1, CN10-23 PA8 remain independent GPIOs. ST UM1724 and the F411 datasheet support all assigned header positions. |
| I²S timing / DMA | I2S2 master TX and I2S2_ext slave RX share PB12/PB13 clocks. Target 16 kHz × two 32-bit slots gives 1.024 MHz BCK. Each 24-bit sample occupies two 16-bit I2S_DR/DMA transfers. RM0383 maps I2S2_ext RX to DMA1 Stream3/Channel3 and I2S2 TX to Stream4/Channel0. This establishes architectural compatibility; measured rate, phase, underruns, and latency remain open. |
| INMP441 | U1 pins 1/3 receive BCK/WS, pin 2 drives MIC_SD to PB14, L/R pin 4 is low for left slot, VDD/CHIPEN pins 7/8 are V3V3, and ground pins 5/6/9 are GND. R6 = 100 kΩ pulls SD low while its unused right slot is high impedance; C1 = 100 nF is local VDD bypass. 3.3 V and 16 kHz/1.024 MHz are within its published ranges. |
| PCM5102A | U2 pins 13/15/14 receive BCK/WS/DIN; SCK pin 12 is grounded for 3-wire BCK PLL mode. FMT pin 16 and DEMP pin 10 are low; FLT pin 11 and XSMT pin 17 are high. CPVDD/AVDD/DVDD pins 1/8/20 are V3V3; CAPP–CAPM C4 = 2.2 µF, VNEG–GND C5 = 2.2 µF, and LDOO–GND C6 = 100 nF. Local supply pairs: DVDD C2/C3, CPVDD C14/C7, AVDD C15/C16. OUTL/OUTR each see a 47 kΩ amplifier input path, satisfying the DAC line-output load condition. |
| MAX97220A | U3 pins 1/9/13 are V3V3; pins 3/6 and exposed pad are GND. C11/C12/C13 = 1 µF bypass the three supply pins; C8 = 1 µF spans C1P/C1N; C9 = 1 µF spans PVSS/PGND; C10 = 100 nF bypasses BIAS. This is the **A** suffix with external gain resistors. Per channel, DAC signal enters IN− through 47 kΩ and OUT feeds IN− through 4.7 kΩ; the corresponding IN+ uses the matching quiet-ground 47 kΩ/4.7 kΩ network from ADI's pseudo-differential circuit. Nominal voltage gain magnitude is 0.1. R7 = 100 kΩ holds active-low SHDN low; SW6 must close and PA8 must go high to enable. |
| Headphone jack | J3 is specifically **SJ-3523-SMT-TR**, not an unidentified “Teensy-compatible” module: pin 1 sleeve = GND, pin 2 tip = HP_L, pin 3 ring = HP_R. MAX OUTL pin 12 and OUTR pin 10 feed the respective contacts directly as allowed by its DirectDrive output. No cross-channel or output-to-ground short appears in the netlist. |
| Controls | R1–R5 = 10 kΩ pull up encoder A/B/push and both buttons to V3V3; each contact closes to GND. GPIOs are 3.3 V only. SW1–SW3 are logical contacts of one as-yet-unselected encoder, so physical encoder terminal numbering is unresolved. Debounce and contact behavior require bench checks. |
| Supply and grounds | Nucleo CN7-16 supplies V3V3; CN7-20 and CN10-20 establish common GND. ST-LINK USB CN1 with JP5 on U5V is the intended source. This schematic does not show Nucleo's onboard regulator, USB enumeration, or rail filtering. Its current/noise headroom under audio load is unmeasured. ADI calls for PGND and SGND to meet at one point and charge-pump returns to stay out of the signal-ground path; the single schematic GND net cannot enforce that physical routing. |

The PCM5102A's nominal full-scale output is 2.1 V RMS. With 0.1 amplifier gain, the *nominal linear estimate* is 0.21 V RMS into a 32 Ω test load (about 1.4 mW per channel). Clipping, source signal, tolerances, earbud impedance/sensitivity, transients, and actual SPL can change the result. This is a conservative electrical starting point, **not acoustic safety**; measure the output before any listener connection.

## Remaining blockers

1. Identify exact microphone, DAC, and amplifier **modules** if the prototype uses breakouts. Bare-IC package pin numbers and passives cannot be transferred to unknown breakout headers. Verify MAX97220 **A** suffix; B/E or C/D variants need separate review.
2. Identify the physical jack. The schematic/footprint is for SJ-3523-SMT-TR only. A “Teensy-compatible” jack has no verified contact map here and must not be wired from J3 numbers.
3. Select exact encoder, buttons, mute switch, bare-IC land patterns, and capacitor part numbers. The present generic 0603 capacitor footprints, especially 10 µF, need effective capacitance and voltage-bias verification. The INMP441 and MAX97220A land patterns remain unselected. Lay out PGND/SGND and matched input-network reference grounds per ADI; this cannot be validated without a physical build.
4. Measure Nucleo V3V3 capacity, startup/peak current, rail noise, and USB/JP1/JP5 configuration with the intended parts and load. An ERC pass cannot establish regulator or USB margin.
5. Confirm actual WS/BCK rate, 24-bit left-slot alignment, DAC PLL behavior, amplifier gain, shutdown behavior, and output DC/RMS/peak levels into a test load. Measure acoustic level with the actual earbuds and a suitable coupler before listener use.

**GO/NO-GO:** **NO-GO** for wiring unidentified modules, committing a PCB, or connecting earbuds to a listener. The reviewed bare-IC schematic may proceed to a controlled bench build only after each physical part is identified, mapped to its datasheet, and the power plan is verified.
