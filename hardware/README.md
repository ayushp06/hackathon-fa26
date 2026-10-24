# AURA KiCad project

Selected schematic parts: bare INMP441, PCM5102A, MAX97220A, and Same Sky SJ-3523-SMT-TR jack. Nucleo CN7/CN10 are represented by physical connector positions from ST UM1724. SW1-SW3 are the logical encoder A/B/push contacts only; their actual package pin numbering is unselected. The selected jack replaces the unidentified "Teensy-compatible" part: terminal 1=sleeve, 2=tip, 3=ring per the Same Sky SJ-352X-SMT datasheet. Its project-local footprint uses KiCad geometry with verified pad renumbering.

Blockers before a PCB or assembly: identify actual microphone/DAC/amplifier modules or build from bare ICs; select verified INMP441 and MAX97220A land patterns; choose exact encoder and buttons; measure Nucleo 3.3 V/USB current and rail noise; calibrate headphone level with the chosen earbuds. No PCB is generated.

MAX97220A gain is -4.7k/47k = -0.1. This is a conservative starting point, not a hearing-safety certification. Manual latching SPST mute switch SW6 must be closed to let PA8 enable the amplifier; 100k holds SHDN low otherwise.

Primary sources: ST UM1724 (https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo-32-boards-stmicroelectronics.pdf); TDK INMP441 (https://product.tdk.com/system/files/dam/doc/product/sw_piezo/mic/mems-mic/data_sheet/inmp441.pdf); TI PCM5102A (https://www.ti.com/lit/ds/symlink/pcm5102a.pdf); ADI MAX97220 (https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf); Same Sky jack (https://www.mouser.com/datasheet/2/1628/sj_352x_smt-3511282.pdf).

## Breadboard module option

Open `AURA_circuit.kicad_sch` for a circuit-style view with the Nucleo, documented modules, passive parts, and switches connected by visible KiCad wires. `AURA_breadboard.kicad_sch` is the separate terminal-by-terminal map; each `X` circle represents the physical pad/contact named above it. Exact wire names and assembly limits are in `../docs/breadboard_wiring.md`. The original `AURA.kicad_sch` remains the bare-IC reference. The module option uses the evaluation kit's onboard HP_OUT jack and an external attenuation network; it is not electrically interchangeable with the bare-IC BOM.
