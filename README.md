# Wavelength — STM32F411RE audio

The current release is [Wavelength-v2](releases/Wavelength-v2/README.md):
two INMP441 microphones, CMSIS-DSP NLMS noise reduction, and USB serial playback
through the computer's AUX output. Both inputs and active filtering were checked
on the NUCLEO-F411RE. Intermittent I2S3 framing errors can stop capture and require
a board reset; continuous operation is not yet reliable.

The single-microphone baseline is preserved as
[Wavelength-v1](releases/Wavelength-v1/README.md). Filter behavior, controls and
limitations are documented in [NLMS noise reduction](audio_passthrough/NLMS.md).

The companion browser app can now send acknowledged controls to the STM32 for
live volume, NLMS strength, speech-band gain, EQ and noise relearning. See
[hardware app setup](audio_passthrough/APP_CONTROL.md). Run
`.\scripts\start-hardware-app.ps1` and open http://localhost:8081.

C11 firmware for the STM32F411RE (Cortex-M4F, 512 KiB flash, 128 KiB RAM).
Uses ST's CMSIS device startup and Arm's CMSIS-Core and CMSIS-DSP. Dependencies
are downloaded from pinned release tags on the first CMake configure.

For a board test requiring no dependency downloads, see
[the standalone hello-world example](examples/hello_world/README.md). It blinks
the Nucleo green LED and prints over the ST-LINK serial port.

For the HAL microphone-to-headphone application, open
[audio_passthrough](audio_passthrough/README.md), a self-contained STM32CubeIDE
project using INMP441 on PB14 and PCM5102A on PB15 with shared I2S clocks.

For microphone playback through the **computer's speakers**, bypassing the DAC
and amplifier, see [PC audio streaming](audio_passthrough/PC_AUDIO.md).

## Build

Install CMake 3.25+, Ninja, and Arm GNU Toolchain (`arm-none-eabi-gcc`, including
newlib). Put their `bin` directories on PATH. The GCC toolchain bundled with
STM32CubeIDE also works when its `tools/bin` directory is on PATH.

```powershell
cmake --preset debug
cmake --build --preset debug
# Optimized firmware:
cmake --preset release
cmake --build --preset release
```

Outputs: `build/debug/firmware.elf`, `.hex`, `.bin`, and `.map` (or
`build/release/`). Debug builds prioritize debugging; use Release for DSP timing.
The compiler and linker both select Cortex-M4, FPv4-SP-D16, and hard-float ABI.
Unused functions and data are discarded at link time.

If you use Make instead of Ninja:

```powershell
cmake -S . -B build/make -G "MinGW Makefiles" "-DCMAKE_TOOLCHAIN_FILE=cmake/arm-none-eabi.cmake" "-DCMAKE_BUILD_TYPE=Debug"
cmake --build build/make
```

Offline configuration supports these CMake variables pointing to extracted
release directories (repository roots):

- `FETCHCONTENT_SOURCE_DIR_CMSIS_CORE`: CMSIS_5 5.9.0
- `FETCHCONTENT_SOURCE_DIR_STM32_DEVICE`: cmsis-device-f4 v2.6.10
- `FETCHCONTENT_SOURCE_DIR_CMSIS_DSP`: CMSIS-DSP v1.16.2

For example, append `"-DFETCHCONTENT_SOURCE_DIR_CMSIS_DSP=C:/deps/CMSIS-DSP"`
to the configure command. All three dependencies must be available offline.

## Firmware and DSP

`src/main.c` runs once, then sleeps. It uses the internal 16 MHz HSI reset
clock, so it requires no external crystal or board-specific pin configuration.
The FPU is enabled by ST's `SystemInit`. ADC, DMA, UART, and GPIO are not
configured; add your acquisition and output code when your wiring is known.

`src/dsp_demo.c` generates 256 synthetic samples at an assumed 8 kHz sample
rate, applies an eight-tap moving-average FIR, computes RMS, and runs a real FFT.
The sample rate describes the synthetic data; it does not configure a timer.
Inspect `g_dsp_results` in a debugger after `dsp_demo_run()`:

- `status`: 0 (`ARM_MATH_SUCCESS`).
- `input_rms`: approximately 0.7071.
- `peak_bin`: 32; `peak_frequency_hz`: 1000.
- `filtered_rms`: much smaller; the example filter has a null at 1 kHz.

The whole CMSIS-DSP library is available via `#include "arm_math.h"` and the
`CMSISDSP` CMake target, including:

| Area | Examples |
| --- | --- |
| Transforms | Real/complex FFT, DCT |
| Filtering | FIR, biquad IIR, convolution, correlation, adaptive filters |
| Math | Basic vector, complex, fast trig, matrix, quaternion |
| Analysis | Statistics, distance, interpolation, windows |
| Control/classification | PID, transforms, Bayes, SVM |

Use `float32_t`, `q31_t`, or `q15_t` as appropriate. Float16 kernels are disabled
for this target. State buffers must persist between blocks for streaming filters.

## Flash and debug

With an ST-LINK connected over SWD, open STM32CubeProgrammer, select ST-LINK,
connect, and program the `.elf` or `.hex`. For `.bin`, use address `0x08000000`.
Reset to run. You can also use OpenOCD if installed:

```powershell
openocd -f interface/stlink.cfg -f target/stm32f4x.cfg -c "program build/debug/firmware.elf verify reset exit"
```

## Git repository

The intended shared repository is
[ayushp06/hackathon-fa26](https://github.com/ayushp06/hackathon-fa26).
This workspace has been initialized as a Git repository. The agent environment
denied `.git/config` changes and blocked network access to GitHub, so the remote
could not be configured or its existing history inspected here.

Run locally to set `origin` and fetch the repository:

```powershell
.\scripts\connect-repo.ps1
git branch -r
```

The script sets `origin` as the default push destination. Inspect and integrate
any existing remote history before making the first commit; this local repository
currently has no commits. Do not force-push over the hackathon team's history.
The script does not commit, merge, or push files.

## Upstream references

- [ST STM32F411RE product documentation](https://www.st.com/en/microcontrollers-microprocessors/stm32f411re.html)
- [CMSIS-DSP documentation](https://arm-software.github.io/CMSIS-DSP/)
- [CMSIS-DSP source and license](https://github.com/ARM-software/CMSIS-DSP/tree/v1.16.2)
- [CMSIS-Core source and license](https://github.com/ARM-software/CMSIS_5/tree/5.9.0)
- [ST device source and license](https://github.com/STMicroelectronics/cmsis-device-f4/tree/v2.6.10)

Upstream license files are retained in the fetched dependency directories.
