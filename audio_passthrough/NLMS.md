# Wavelength: dual-microphone NLMS noise reduction

The verified unfiltered PC-headphone setup is preserved as
[Wavelength-v1](../releases/Wavelength-v1/README.md), including its source archive,
firmware, matching Windows player, and SHA-256 manifest.

The experimental NLMS build uses the STM32's two I2S channel slots:

| Connection | Voice mic / primary | Background mic / reference |
| --- | --- | --- |
| VDD | 3.3 V | 3.3 V |
| GND | Common GND | Common GND |
| SCK | PB13 | PB13 |
| WS | PB12 | PB12 |
| SD | PB14, shared | PB14, shared |
| L/R | **GND: left** | **3.3 V: right** |

Both microphone outputs share SD because each should drive only its selected
channel. Do not select the same channel on both connected SD outputs. Position
the voice mic close to the talker, and the reference mic near the background
source and away from the talker. Both need to hear correlated background noise.

## What the filter does

CMSIS-DSP `arm_lms_norm_f32` uses a 128-tap floating-point adaptive filter at
16 kHz. The reference microphone feeds `pSrc`; the delayed primary microphone
feeds CMSIS's desired-response argument `pRef`. The estimated noise is `pOut`;
**the residual `pErr` is the cleaned audio**. The residual is converted to PCM16
and sent through the existing USB serial bridge to the computer's headphone/AUX
output. The external DAC/amplifier is not used.

Identical approximately 25 Hz DC blockers remove input drift. A 32-sample
primary delay (2 ms) gives the causal filter some timing margin between the two
microphones. The step size is 0.08. The first two seconds with a usable reference
learn background noise; keep quiet during that interval. A simple primary/reference
power-ratio guard then freezes coefficient updates during primary-dominant sound.
It does not reliably detect all speech or prevent cancellation of voice leaking
into the reference. Adaptation also freezes for weak reference or clipped input.

The filter falls back to the delayed, DC-blocked primary signal if the reference
is missing, or if bypass is selected. Wet/dry transitions are faded over about
31 ms. Non-finite results or excessive coefficient energy reset the adaptive
kernel. Output is saturated to the 24-bit range before PCM16 conversion.
All state is static; processing allocates no memory and makes no UART calls in
the audio interrupt. Reference-window energy is recalculated per block to avoid
long-running floating-point subtraction drift.

This reduces predictable background in the **transmitted microphone audio**.
It does not generate anti-noise to cancel room sound at the listener's ears.
Incoherent noise and voice contamination in the reference limit performance.

## Build and run

From the repository root, with Arm GCC and the chosen build generator on PATH:

```powershell
cmake -S audio_passthrough -B build/audio-nlms -G Ninja "-DCMAKE_TOOLCHAIN_FILE=$PWD/cmake/arm-none-eabi.cmake" "-DCMAKE_BUILD_TYPE=Release" -DAUDIO_PC_STREAM=ON -DAUDIO_NLMS=ON -DAUDIO_PIN_PROBE=OFF -DAUDIO_DAC_TEST_TONE=OFF
cmake --build build/audio-nlms
.\scripts\play-mic.ps1 -Stop
& 'C:\Program Files\STMicroelectronics\STM32Cube\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe' -c port=SWD -d build/audio-nlms/AudioPassthrough.elf -v -rst
.\scripts\play-mic.ps1 -ListDevices
.\scripts\play-mic.ps1 -Port COM8 -DeviceIndex 0 -Background
```

The tested build directory uses `MinGW Makefiles`; retain that generator when
reconfiguring it. The STM32CubeIDE project now enables PC streaming and NLMS in
both configurations, includes the two CMSIS kernels, and uses optimization O2
to meet the audio deadline. CMake keeps NLMS optional and OFF by default.

## A/B controls

While the updated background player owns COM8:

```powershell
.\scripts\play-mic.ps1 -Bypass       # Hear the delayed/DC-blocked primary mic
.\scripts\play-mic.ps1 -EnableFilter # Resume NLMS subtraction and adaptation
.\scripts\play-mic.ps1 -ResetFilter  # Relearn the background; keep quiet for 2 seconds
.\scripts\play-mic.ps1 -Stop
```

Resetting does not enable a manually bypassed filter; use EnableFilter as needed.
The wrapper sends commands through the running player's command file so it does
not compete for COM8. UART commands are `b`, `n`, and `r`. Firmware applies them
at a block boundary. Manual reset clears learned coefficients; diagnostic clipping
and numerical-reset flags remain latched until the board restarts.

Watch `build/pc-mic-playback.log`. Alongside normal transport counters, it reports:

- `filter=nlms`: reference is usable and coefficients are adapting.
- `filter=hold`: adaptation is frozen; learned subtraction remains enabled.
- `filter=no-reference`: reference energy is too low; primary audio is passed.
- `filter=bypass`: manual bypass.
- `primaryRms`, `referenceRms`, `outputRms`: most recent 64-sample block levels,
  expressed in PCM16 units after DC blocking/delay. These are signal levels, not
  calibrated sound pressure or proof of improved speech SNR.
- `maxCycles`: maximum audio callback cycles, including NLMS and packet packing.
- `reset`, `clipped`: latched numerical-recovery and output-saturation indicators.

The enhanced `MIC2` packets have a 32-byte header: the original first 16 bytes,
followed by four little-endian uint32 values for primary RMS, reference RMS,
output RMS, and callback cycles. They contain 128 bytes of PCM and a trailing
CRC16: 162 bytes total. Header flags indicate firmware drops (bit 0), NLMS
support (1), missing reference (2), frozen adaptation (3), numerical reset (4),
manual bypass (5), and clipping (6). The updated PC player accepts both MIC1 and
MIC2, so it can still play the Wavelength-v1 baseline.

## Verification and current limit

### Optional separate-data capture

An alternative receiver is prepared under `AUDIO_DUAL_DATA=ON`, with NLMS and
PC streaming also enabled. It has been built, flashed, and readback-verified.
Continuous dual-microphone capture is **not yet validated**. It needs these physical connections:

| Connection | Voice microphone | Reference microphone |
| --- | --- | --- |
| SD | PB14 | **PC12**, disconnected from PB14 |
| L/R | GND | **GND** |
| SCK | PB13 | PB13 |
| WS | PB12 | PB12 |
| VDD / GND | 3.3 V / common GND | 3.3 V / common GND |

Also connect **PB13 to PC10** and **PB12 to PA4**. I2S2 remains the clock master;
I2S3 is a slave receiver using PC10 CK, PA4 WS and PC12 SD, all AF6. Its RX DMA
uses DMA1 Stream0 Channel0. The two data outputs must remain separate when both
microphones select left. GPIO mappings were checked against the STM32F411
datasheet and installed CubeMX device database.

On the NUCLEO-F411RE morpho headers, these jumpers are CN10 pin 30 to CN7
pin 1 (PB13 to PC10), and CN10 pin 16 to CN7 pin 32 (PB12 to PA4).
Reference SD is CN7 pin 3 (PC12). These are connector pin numbers, not Arduino
digital pin names; see UM1724 Table 29.

An earlier startup diagnostic reported clock flags `0x5`: activity at PB13
and PB12, but none detected at PC10 or PA4. Reference DMA remained at 512
halfwords, with zero reference callbacks and three primary callbacks before a
synchronization fault stopped streaming. Verify the two clock jumpers before
assessing microphone data or NLMS performance.

After the clock wiring was corrected, both receivers transferred data. A
startup frame error initially stopped capture. Clearing FRE alone was unreliable;
the final fix enables the slave during the running master's WS-high interval.
No startup frame error is suppressed in the final code; ongoing framing/overrun
and buffer synchronization checks remain enabled. A 12-second
left-slot playback check and a temporary five-second right-slot diagnostic both
had zero transport drops, CRC failures, underruns, and overflows. The voice input
changed, but reference RMS stayed zero in both slot tests. The user confirmed
reference L/R is grounded. Left-slot capture was restored; cancellation remains
bypassed pending a usable reference signal. AUX playback uses Realtek device 0.

After swapping only SD connections, the original voice microphone produced
changing samples through PC12, while the noise microphone produced zero audio
through PB14 in separate left- and right-slot tests. The silence followed the
noise microphone path; this does not distinguish the module from its power,
clock, data jumper, or solder connections. Two further four-second checks across
a reset passed without transport errors after correcting slave startup.

The swap test used voice SD on PC12 and noise SD on PB14, with
`AUDIO_SWAP_MIC_INPUTS=ON`. The user subsequently restored voice SD to PB14 and
noise SD to PC12, both L/R grounded. The latest flashed `build/audio-nlms-dual`
configuration has `AUDIO_SWAP_MIC_INPUTS=OFF`, matching the table above.
An eight-second live playback check captured changing voice input, but reference
RMS remained zero. There were 2,026 packets and no missing packets, CRC errors,
firmware drops, playback underruns, or overflows. Callback maximum was 159,144
cycles. NLMS is enabled but automatically bypasses cancellation until reference
audio is present; this is not a successful real-room cancellation test.

After the user corrected the reference microphone SCK connection, a new
eight-second live test captured changing signals from both microphones with
`filter=nlms`. Recent primary/reference/output RMS examples were 16/8/4,
10/11/2, and 16/28/2 in PCM16 units. All 2,024 packets arrived without missing
packets, CRC failures, firmware drops, playback underruns, or overflows.
The maximum callback cost was 163,634 cycles (about 1.70 ms at 96 MHz), below
the 4 ms block period, with no numeric resets or clipping reported. Background
AUX playback was started with NLMS enabled. Lower output RMS demonstrates
signal attenuation, not measured noise-only attenuation or speech preservation;
audible quality and sustained operation still require validation.

The master starts first; slave DMA is armed after a low-to-high WS edge while
WS is high, as required for Philips slave synchronization by RM0383. The rings
remain clock-locked with a fixed startup offset of approximately one frame;
the primary delay gives NLMS room to model that offset. Processing waits
for matching completed halves from both receivers and checks both DMA ownership
positions. A missing/late receiver or I2S error stops the stream instead of mixing
unpaired blocks. This option avoids reliance on the reference mic's right slot;
it does not improve the NLMS algorithm or establish the cause of the existing
right-slot failure. Leave the option OFF for shared-SD wiring.

Host C tests passed synthetic correlated-noise convergence, preservation of an
independent desired tone, missing-reference bypass, and controls. The ideal
synthetic tests require >25 dB noise attenuation and desired-tone output SNR;
they are not measurements of real-room performance. Firmware built and flashed
successfully. STM32CubeIDE Debug also built with zero errors and warnings.
The observed callback maximum was about 159,000 cycles (1.66 ms at 96 MHz),
within the 4 ms block deadline, and live transport had no packet/CRC errors.

On the physical setup, the right reference slot initially remained zero.
The second microphone produced changing data when tested alone as left, but
the isolated right-only test was silent. Until both channel inputs are confirmed,
real background-noise reduction remains **unverified** and the filter deliberately
passes primary audio instead of pretending cancellation is active. See
[VALIDATION.md](VALIDATION.md) for the evolving hardware checks.

Reproduce the deterministic host test with native GCC:

```powershell
gcc -O2 -std=c11 -D__GNUC_PYTHON__ -DARM_MATH_AUTOVECTORIZE -DAUDIO_NLMS -Iaudio_passthrough/Core/Inc -Iaudio_passthrough/Drivers/CMSIS/DSP/Include tests/noise_filter_test.c audio_passthrough/Core/Src/noise_filter.c audio_passthrough/Drivers/CMSIS/DSP/Source/FilteringFunctions/arm_lms_norm_f32.c audio_passthrough/Drivers/CMSIS/DSP/Source/FilteringFunctions/arm_lms_norm_init_f32.c -lm -o build/noise_filter_test.exe
.\build\noise_filter_test.exe
```

Primary algorithm references:
[Arm CMSIS normalized LMS](https://arm-software.github.io/CMSIS-DSP/v1.14.4/group__LMS__NORM.html),
[MathWorks acoustic noise cancellation](https://www.mathworks.com/help/dsp/ug/acoustic-noise-cancellation-lms.html).
The vendored CMSIS kernels/headers retain their Apache-2.0 notices and license.
