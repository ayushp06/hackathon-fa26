# AURA module breadboard wiring

[Open the circuit-style schematic](../hardware/AURA_circuit.kicad_sch) or its [PDF](../hardware/exports/AURA_circuit_schematic.pdf) to see the Nucleo, microphone, DAC, amplifier, resistors, capacitor, and switches as conventional connected circuit blocks. The signal paths use actual green KiCad wires; standard `+3.3V` and `GND` symbols connect their respective rails. Its [ERC report](../hardware/exports/AURA_circuit_erc.rpt) and [netlist](../hardware/exports/AURA_circuit_netlist.net) are exported from that sheet.

The separate [terminal-by-terminal wiring map](../hardware/AURA_breadboard.kicad_sch) and [PDF](../hardware/exports/AURA_breadboard_schematic.pdf) name every physical pad/contact. Each `X` circle is a pad marker, not a part to buy. The existing [AURA.kicad_sch](../hardware/AURA.kicad_sch) is the **bare-IC reference**, with its required chip-level capacitors and gain network. Do not add those parts a second time to a module build.

## Exact selected boards

| Schematic | Buy/use this specific board | Pinout source |
| --- | --- | --- |
| M1 | ShillehTek **INMP441 Pre-Soldered I2S Omnidirectional Microphone Module**, six labeled 2.54 mm pads | [ShillehTek module manual](https://shillehtek.com/blogs/shillehtek-product-manuals/inmp441-i2s-omnidirectional-microphone-module-with-soldering-manual), [TDK INMP441 IC datasheet](https://product.tdk.com/system/files/dam/doc/product/sw_piezo/mic/mems-mic/data_sheet/inmp441.pdf) |
| M2 | Adafruit **PCM5102 I2S DAC**, product **6250**; use its labeled breakout pads, not its line-output jack | [Adafruit product](https://www.adafruit.com/product/6250), [Adafruit pinout](https://learn.adafruit.com/adafruit-pcm510x-i2s-dac?view=all), [TI PCM5102A datasheet](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf) |
| M3 | Analog Devices/Maxim **MAX97220AEVKIT+** evaluation board; its onboard **HP_OUT** is the final 3.5 mm headphone jack | [ADI evaluation-kit manual and schematic](https://www.analog.com/media/en/technical-documentation/data-sheets/max97220aevkit.pdf), [MAX97220A datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf) |
| J1 | **NUCLEO-F411RE** | [ST UM1724 CN7/CN10 Table 29](https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo-32-boards-stmicroelectronics.pdf) |

These boards are a **specific documented option**, not a universal Amazon pinout. Check the printed board names and revision against these sources when the parts arrive. The amplifier evaluation kit is a separate PCB with solder/test pads, not a DIP that plugs into breadboard holes; use short soldered leads to the breadboard. The unidentified “Teensy-compatible” jack is replaced by the kit's documented HP_OUT jack. The Adafruit jack is **line output only**; do not plug earbuds into it.

Additional parts: two 47 kΩ resistors (R1/R3), seven 10 kΩ resistors (R2/R4/R6–R10), one 100 kΩ resistor (R5), one 100 nF capacitor (C1), one passive rotary encoder with push, two normally open buttons, one latching SPST mute switch, insulated leads, and two suitable 32 Ω resistive dummy loads. Verify the actual switch terminals and resistor values before connecting power.

## Wire list

Pad names below are vendor labels. Neither vendor manual assigns reliable numeric pad positions to all of these modules, so the schematic uses **label names as terminal identifiers**. Match text on the actual board, not an assumed left-to-right sequence. The sheet is a wiring map: its terminal circles are not the physical placement or orientation of the boards.

| Source | Destination |
| --- | --- |
| Nucleo **CN7 pin 16**, regulated 3.3 V | M1 **VDD**, M2 **VIN**, M3 **VDD**, M2 **FIL**, M2 **MU**, C1 100 nF high side, R6–R10 10 kΩ pullup high sides |
| Nucleo **CN7 pin 20** and **CN10 pin 20**, GND | M1 **GND** and **L/R**, M2 **GND** and **FM** and **DE**, M3 **GND**, C1 low side, R5 100 kΩ low side, all control-switch returns |
| Nucleo **PB12 / CN10 pin 16**, I2S_WS | M1 **WS**, M2 **WSEL** |
| Nucleo **PB13 / CN10 pin 30**, I2S_BCK | M1 **SCK**, M2 **BCK** |
| M1 **SD** | Nucleo **PB14 / CN10 pin 28**; R5 100 kΩ to GND on this net |
| Nucleo **PB15 / CN10 pin 26**, DAC_DIN | M2 **DIN** |
| M2 **Lout** | R1 47 kΩ in series; far end is `AMP_L_IN` to M3 **INL−** and R2 10 kΩ to GND |
| M2 **Rout** | R3 47 kΩ in series; far end is `AMP_R_IN` to M3 **INR−** and R4 10 kΩ to GND |
| M2 **G** (quiet analog return) | M3 **INL+** and **INR+**, returned to common GND. Keep this reference lead alongside the Lout/Rout leads. |
| Nucleo **PA8 / CN10 pin 23** | SW6 latching SPST input; SW6 output to M3 **JU1 SHDN side** with the JU1 shunt **removed**. The kit's R9 100 kΩ should pull SHDN low when SW6 is open. |
| Nucleo **PA0 / CN7 pin 28** | Encoder A contact / SW1 to GND, R6 10 kΩ pullup to 3.3 V |
| Nucleo **PA1 / CN7 pin 30** | Encoder B contact / SW2 to GND, R7 10 kΩ pullup to 3.3 V |
| Nucleo **PA4 / CN7 pin 32** | Encoder push / SW3 to GND, R8 10 kΩ pullup to 3.3 V |
| Nucleo **PB0 / CN7 pin 34** | Button 1 / SW4 to GND, R9 10 kΩ pullup to 3.3 V |
| Nucleo **PB1 / CN10 pin 24** | Button 2 / SW5 to GND, R10 10 kΩ pullup to 3.3 V |
| M3 **HP_OUT** onboard 3.5 mm jack | Stereo 32 Ω dummy loads for initial testing; earbuds only after level measurement and review |

M2 **MCK** is unused because the breakout supports three-wire I²S from BCK; its **3V** pin is a regulator output and is left open. M2 **FIL** high selects the low-latency filter, **MU** high enables playback, **FM** low selects I²S, and **DE** low disables de-emphasis according to the [Adafruit guide](https://learn.adafruit.com/adafruit-pcm510x-i2s-dac?view=all). M3 **OUTL/OUTR** test pads are unused externally because HP_OUT is already wired on the kit. The controls are passive contacts; the purchased encoder's actual physical lead order still needs a continuity check.

The [ADI kit manual](https://www.analog.com/media/en/technical-documentation/data-sheets/max97220aevkit.pdf) specifies 10 kΩ input and feedback resistors on the board (nominal unity amplifier gain) and R9 = 100 kΩ on SHDN. The external 47 kΩ series/10 kΩ shunt networks create about **0.1 V/V nominal midband attenuation** after the kit's input loading. This is a calculation and must be measured, including clipping and startup transients. Do not substitute an unknown MAX97220 module or omit R1–R4.

## Before energizing

1. Confirm all three exact board versions, their printed pad labels, the Nucleo header orientation, and the encoder/switch contacts. **Find which physical JU1 pin on M3 reaches SHDN/R9 by unpowered continuity**; the manual defines the jumper behavior but does not give a safe left/right jumper-pin number. Never connect PA8 to the VDD side of JU1.
2. Remove the M3 JU1 shunt and open SW6. Verify SHDN is pulled to GND through the kit's R9. Verify no 3.3 V-to-GND short, all grounds continuous, and the M2 **3V** output is not tied to the Nucleo supply.
3. Use USB ST-LINK CN1 with JP5 on U5V pins 1–2; configure JP1 for the actual host/charger mode per ST UM1724. Verify the complete Nucleo-plus-module 3.3 V current budget before power. Keep short I²S wires and local C1 at M1; breadboard wiring can create clock edges and audio-ground noise that ERC cannot detect.
4. Follow [hardware_bringup.md](hardware_bringup.md), using the module pad names above and M3 HP_OUT. Start with dummy loads; do not connect earbuds to a listener until output levels and transients are measured.

**Status: conditional bench prototype only.** KiCad ERC and netlist verify the drawn external connections, not undocumented board revisions, exact physical pad order, supply margin, clock accuracy, loopback behavior, or acoustic safety.
