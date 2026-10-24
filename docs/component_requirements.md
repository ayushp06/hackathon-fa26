# Component and passive requirements

The KiCad schematic in [hardware/](../hardware/README.md) selects the bare **MAX97220A** and a documented replacement jack; the original modules and jack in hand still require identification.

Values below refer to **bare ICs** and their manufacturer circuits. A purchased module may already contain some or all parts; inspect its schematic and physical assembly before adding duplicates.

| Part | Electrical requirement | Required external parts / connections | Datasheet |
| --- | --- | --- | --- |
| INMP441 | VDD 1.8–3.3 V; 24-bit I²S slave; 64 SCK per WS frame | 0.1 µF at VDD to nearby GND; 100 kΩ SD to GND for its high-impedance slot; tie CHIPEN high and L/R low for left slot. Keep acoustic bottom port unobstructed. | [TDK DS-INMP441-00, pin table and Fig. 7](https://product.tdk.com/system/files/dam/doc/product/sw_piezo/mic/mems-mic/data_sheet/inmp441.pdf) |
| PCM5102A | AVDD and CPVDD 3.3 V; DVDD 3.3 V in this design; BCK PLL supports 16 kHz at 64× fs; single-ended OUTL/R | Ground SCK for 3-wire mode; FMT low; DEMP low; XSMT high for playback; select FLT for latency. Decouple AVDD, CPVDD, DVDD and LDOO. Add the CAPP–CAPM flying capacitor and VNEG reservoir capacitor per TI Fig. 33 (2.2 µF each), plus local 0.1 µF and bulk caps shown there. Keep OUTL/R loads at or above the stated 1 kΩ line-load capability before the amplifier. | [TI SLAS859C, pp. 5, 24–28](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf) |
| MAX97220**A selected in schematic** | Supply 2.5–5.5 V; SHDN low disables; ground-centered stereo outputs; differential or pseudo-differential inputs | At the bare IC: 1 µF from PVDD, SVDD and SVDD2 to ground; 1 µF C1P–C1N; 1 µF PVSS–PGND; 0.1 µF BIAS–PGND. The selected A suffix uses external 47 kΩ input and 4.7 kΩ feedback/reference resistors. C/D include fixed +6 dB gain and are not schematic substitutes. | [ADI MAX97220A–E, pp. 11–13](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf) |
| NUCLEO-F411RE | USB CN1 power, JP5 U5V position; +3.3 V at CN7-16 | Budget board plus added load within USB 300 mA (JP1 off) or 100 mA (JP1 on); confirm 3.3 V rail capacity and noise under maximum headphone load. Add local analog rail filtering only after its impedance and transient behavior are checked. | [ST UM1724 §§7.5, Table 29](https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo-32-boards-stmicroelectronics.pdf) |

## Additional hardware to identify or obtain

- Exact MAX97220 suffix or verified amplifier module, with its gain network and SHDN access. The fixed +6 dB variants can overdrive the earbud path from a 2.1 V RMS DAC signal; output gain and maximum level require calibration with the actual load.
- Exact 3.5 mm TRS jack part number and datasheet, including contact orientation, switch pins, insulation, and whether “Teensy-compatible” refers to a footprint or a board module. Map tip/ring/sleeve from that part's document.
- Encoder and switch part numbers or module schematics. Determine whether they have pullups, LEDs, resistors, or 5 V-only circuitry. GPIO wiring assumes passive contacts at 3.3 V.
- A verified power budget, 3.3 V distribution choice, and any required regulator/filter parts. Include Nucleo, both audio ICs, headphone load, and startup/inrush.
- Prototype wiring with common ground, short clock/data runs, accessible test points for WS/BCK/SD/DIN, and local decoupling at each bare IC. These physical implementation parts are needed before a schematic/BOM can be finalized.

The PCM5102A outputs are already line-level and ground-centered; its datasheet does not require output DC-blocking capacitors. The MAX97220 DirectDrive outputs likewise do not require large headphone series coupling capacitors. Any RF/EMI output network must be selected against the chosen cable and jack, rather than copied blindly. [TI PCM5102A description](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf), [ADI MAX97220 description](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf)
