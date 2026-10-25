# Wavelength-v2

Dual INMP441 microphones -> STM32F411RE CMSIS-DSP NLMS -> ST-LINK USB serial
-> Windows AUX/headphone output. Released 2026-10-25 after the user confirmed
the core behavior works. This path bypasses the external PCM5102A/MAX97220.

## Wiring

| Signal | Voice microphone | Noise microphone | STM32 loopback |
| --- | --- | --- | --- |
| VDD | 3.3 V | 3.3 V | |
| GND | Common GND | Common GND | |
| L/R | GND | GND | |
| SD | PB14 | PC12 (CN7 pin 3) | Keep data lines separate |
| SCK | PB13 | PB13 | PB13 to PC10 (CN7 pin 1) |
| WS | PB12 | PB12 | PB12 to PA4 (Arduino A2) |

## Restore and play

From the repository root, stop playback before flashing:

```powershell
.\scripts\play-mic.ps1 -Stop
STM32_Programmer_CLI -c port=SWD -d releases/Wavelength-v2/Wavelength-v2.elf -v -rst
.\scripts\play-mic.ps1 -ListDevices
.\scripts\play-mic.ps1 -Port COM8 -DeviceIndex 0 -Background
```

Put STM32CubeProgrammer's `bin` directory on PATH, or use its full executable
path. COM8 and Realtek headphone device 0 were used on the development PC;
select the matching local serial port and audio device. The bundled player can
also run directly with `--port COM8 --device 0`.

NLMS starts enabled. Keep background noise present and stay quiet during its
first two seconds. Place the voice mic near the speaker and the reference mic
where it hears mostly the same background noise, with less desired speech.

```powershell
.\scripts\play-mic.ps1 -Bypass
.\scripts\play-mic.ps1 -EnableFilter
.\scripts\play-mic.ps1 -ResetFilter
.\scripts\play-mic.ps1 -Stop
```

## Build configuration

The self-contained source is in `audio_passthrough/`, also supplied in the
source archive. Use an Arm GNU toolchain and CMake with Ninja or Make:

```powershell
cmake -S audio_passthrough -B build/wavelength-v2 -G Ninja -DCMAKE_TOOLCHAIN_FILE=cmake/arm-none-eabi.cmake -DCMAKE_BUILD_TYPE=Release -DAUDIO_PC_STREAM=ON -DAUDIO_NLMS=ON -DAUDIO_DUAL_DATA=ON -DAUDIO_SWAP_MIC_INPUTS=OFF -DAUDIO_PIN_PROBE=OFF -DAUDIO_DAC_TEST_TONE=OFF
cmake --build build/wavelength-v2
```

Transport is 16 kHz mono PCM16 at 921600 baud using MIC2 packets. Capture uses
24-bit samples in 32-bit I2S slots, 64-frame blocks and circular DMA. The filter
uses 128 taps, step size 0.08 and a 32-sample primary delay. A missing reference
automatically bypasses cancellation. Background playback logs are written to
`build/pc-mic-playback.log` and `build/pc-mic-playback-error.log`.

## Validation and known limitation

Both microphones and active NLMS were observed on the board. A five-second
check received 1,269 packets with no transport errors or playback underruns;
maximum callback time was about 1.70 ms against a 4 ms block period. Lower
output RMS does not establish speech preservation or quantify noise reduction.

**Intermittent I2S3 framing errors stop capture.** Reset the board and restart
playback to recover; use the physical RESET button if a debugger reset does not
restore packets. This is a working prototype, with sustained stability still
unresolved. See `audio_passthrough/VALIDATION.md` for the test record.

## Artifacts

- `Wavelength-v2.elf`, `.hex`, `.bin`: built and flashed firmware.
- `pc-mic-player.exe`: matching Windows playback bridge.
- `source.zip`: firmware, scripts, tests and build documentation.
- `manifest.json`: configuration, validation limits and artifact SHA-256 hashes.

Wavelength-v1 remains available as the single-microphone baseline.
