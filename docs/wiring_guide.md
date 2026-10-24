# AURA wiring guide — verified bare parts

This guide describes the exact **schematic pins** for a NUCLEO-F411RE, bare INMP441, PCM5102A **PW/TSSOP-20**, MAX97220**A**, and Same Sky **SJ-3523-SMT-TR**. It is **not** a pinout for unspecified microphone, DAC, amplifier, encoder, or “Teensy-compatible” jack modules. Use the [electrical review](electrical_review.md) blockers before construction. IC/package pin numbering comes from [TDK](https://product.tdk.com/system/files/dam/doc/product/sw_piezo/mic/mems-mic/data_sheet/inmp441.pdf), [TI](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf), and [ADI](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf); board header numbering comes from [ST UM1724 Table 29](https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo-32-boards-stmicroelectronics.pdf); jack numbering comes from the [Same Sky drawing](https://www.mouser.com/datasheet/2/1628/sj_352x_smt-3511282.pdf).

## Nucleo header to IC signal pins

| Net / purpose | Nucleo MCU and header position | Exact destination pins |
| --- | --- | --- |
| I2S_WS / LRCK | PB12, **CN10 pin 16**, AF5 | INMP441 U1 pin 3 WS; PCM5102A U2 pin 15 LRCK; TP3 |
| I2S_BCK | PB13, **CN10 pin 30**, AF5 | INMP441 U1 pin 1 SCK; PCM5102A U2 pin 13 BCK; TP4 |
| MIC_SD | PB14, **CN10 pin 28**, AF6 I2S2ext_SD | INMP441 U1 pin 2 SD; R6 pin 1; TP5 |
| DAC_DIN | PB15, **CN10 pin 26**, AF5 I2S2_SD | PCM5102A U2 pin 14 DIN; TP6 |
| V3V3 | Nucleo regulated +3.3 V, **CN7 pin 16** | U1 pins 7 VDD and 8 CHIPEN; U2 pins 1 CPVDD, 8 AVDD, 11 FLT, 17 XSMT, 20 DVDD; U3 pins 1 PVDD, 9 SVDD2, 13 SVDD; R1–R5 pin 1; supply bypass high sides; TP1 |
| GND | **CN7 pin 20** and **CN10 pin 20** | All GND connections listed below; TP2. Use a common return with short local bypass paths. |

Supply the Nucleo through its ST-LINK USB **CN1**. For an enumerating USB host, set **JP5 pins 1–2 (U5V)** and remove **JP1** per UM1724; this uses the documented 300 mA board-plus-extensions USB configuration. JP1 fitted is limited to 100 mA. Verify the exact Nucleo revision and measure available 3.3 V margin before attaching audio ICs. Do not supply bare audio ICs from CN7 5 V.

## Bare microphone and DAC pins

| Part | Pin-to-net / passive wiring |
| --- | --- |
| INMP441 U1 | Pin 1 SCK → I2S_BCK; 2 SD → MIC_SD; 3 WS → I2S_WS; 4 L/R → GND (left slot); 5 GND, 6 GND, 9 bottom pad GND → GND; 7 VDD and 8 CHIPEN → V3V3. C1 100 nF from VDD to GND at U1. R6 100 kΩ from MIC_SD to GND. Keep its bottom acoustic port open. |
| PCM5102A U2 digital/config | Pin 10 DEMP → GND; 11 FLT → V3V3 (low-latency filter); 12 SCK → GND (3-wire BCK PLL); 13 BCK → I2S_BCK; 14 DIN → DAC_DIN; 15 LRCK → I2S_WS; 16 FMT → GND (I²S); 17 XSMT → V3V3 (playback enabled). |
| PCM5102A U2 supplies | Pin 1 CPVDD → V3V3, pin 3 CPGND → GND, pin 8 AVDD → V3V3, pin 9 AGND → GND, pin 19 DGND → GND, pin 20 DVDD → V3V3. C7 10 µF and C14 100 nF belong at CPVDD; C15 100 nF and C16 10 µF at AVDD; C2 100 nF and C3 10 µF at DVDD. Each pair returns to local GND. |
| PCM5102A U2 charge pump / outputs | C4 2.2 µF between pin 2 CAPP and pin 4 CAPM. C5 2.2 µF from pin 5 VNEG to GND. C6 100 nF from pin 18 LDOO to GND; never use LDOO as an external supply. Pin 6 OUTL → DAC_L / TP9 / R8 pin 1; pin 7 OUTR → DAC_R / TP10 / R12 pin 1. |

TI specifies the PCM5102A line outputs as ground-centered. The chosen direct-coupled input network has a defined ground reference; no output coupling capacitor is drawn. Check actual DAC output DC and startup behavior on TP9/TP10 before amplifier enable.

## MAX97220A, analog network, and jack

| Function | Exact connection |
| --- | --- |
| Amplifier supply | U3 pins 1 PVDD, 9 SVDD2, 13 SVDD → V3V3. C11/C12/C13 each 1 µF to GND, placed at the respective pins. U3 pins 3 PGND, 6 SGND, and EP/exposed pad → GND. |
| Charge pump / bias | C8 1 µF between U3 pin 2 C1P and pin 4 C1N. C9 1 µF from U3 pin 5 PVSS to GND/PGND. C10 100 nF from U3 pin 11 BIAS to GND. These internal pump/bias nodes must not connect to the headphone jack. |
| Left pseudo-differential input | U2 pin 6 DAC_L → R8 47 kΩ → U3 pin 14 INL−. U3 pin 12 OUTL → R10 4.7 kΩ → pin 14 INL−. GND → R9 47 kΩ → U3 pin 15 INL+; U3 pin 15 INL+ → R11 4.7 kΩ → GND. Follow ADI's pseudo-differential reference-ground routing. |
| Right pseudo-differential input | U2 pin 7 DAC_R → R12 47 kΩ → U3 pin 8 INR−. U3 pin 10 OUTR → R14 4.7 kΩ → pin 8 INR−. GND → R13 47 kΩ → U3 pin 7 INR+; U3 pin 7 INR+ → R15 4.7 kΩ → GND. |
| Shutdown / manual mute | PA8 at **CN10 pin 23** → SW6 latching SPST pin 1; SW6 pin 2 → U3 pin 16 SHDN / TP11. R7 100 kΩ from SHDN to GND. With SW6 open or PA8 low, U3 remains shut down. SW6 physical terminals depend on its selected part. |
| Output jack | U3 pin 12 OUTL → HP_L / TP7 → J3 **pin 2 tip**. U3 pin 10 OUTR → HP_R / TP8 → J3 **pin 3 ring**. J3 **pin 1 sleeve** → GND. This map applies only to SJ-3523-SMT-TR, which has no switch contacts in this three-terminal configuration. |

R8/R9/R12/R13 = 47 kΩ and R10/R11/R14/R15 = 4.7 kΩ set an electrical voltage gain magnitude of 0.1 for the **A** suffix. Do not substitute a C/D fixed-gain variant or a board whose onboard gain network is unknown.

## User controls

| MCU input | Nucleo header | Schematic pullup and contact |
| --- | --- | --- |
| Encoder A | PA0, CN7 pin 28 | R1 10 kΩ to V3V3; SW1 from ENC_A to GND |
| Encoder B | PA1, CN7 pin 30 | R2 10 kΩ to V3V3; SW2 from ENC_B to GND |
| Encoder push | PA4, CN7 pin 32 | R3 10 kΩ to V3V3; SW3 from ENC_SW to GND |
| Button 1 | PB0, CN7 pin 34 | R4 10 kΩ to V3V3; SW4 from BTN1 to GND |
| Button 2 | PB1, CN10 pin 24 | R5 10 kΩ to V3V3; SW5 from BTN2 to GND |

SW1–SW3 are **three logical contacts of one encoder**, not its physical lead numbers. The encoder common and each button's second contact go to GND. Confirm the purchased parts' terminal map and any onboard electronics before wiring. Keep all control signals at 3.3 V.

## Physical build constraints

Use short clock/data leads and a common ground return; place each bypass capacitor beside its named IC pin. At U3, follow ADI's layout guidance: join SGND and PGND at one physical point and keep charge-pump currents out of signal-ground returns. The generic test-point symbols TP1–TP11 require an accessible pad or clip location selected during assembly. The generic 0603 footprints do not guarantee effective 10 µF capacitance at 3.3 V; select and check actual capacitor part numbers. An unknown module or jack requires its own documented mapping; do not infer header order from IC package pins.
