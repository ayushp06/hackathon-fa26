# Wavelength-v3

Saved working checkpoint, 2026-10-25: two INMP441 microphones -> NUCLEO-F411RE
DSP -> ST-LINK USB serial -> Windows Headphone/AUX output, controlled by the
Wavelength browser companion app. The user confirmed this setup works.
The external PCM5102A/MAX97220 path is bypassed.

## Preserved files

- `Wavelength-v3.elf`, `.hex`, `.bin`: current app-control firmware.
- `pc-mic-player.exe`: matching Windows audio/command bridge.
- `source.zip`: firmware, browser app, dependency lockfile, scripts, tests and
  project documentation; excludes generated builds, node_modules and old releases.
- `active-settings.json`: applied hardware dial values observed when saving.
  These are a user-selected preset, not calibration or recommended levels.
- `manifest.json`: source revision, build flags, validation and SHA-256 hashes.

The Git tag **Wavelength-v3** preserves this checkpoint. Earlier Wavelength-v1
and Wavelength-v2 files remain unchanged.

## Wiring

| Signal | Voice microphone | Reference microphone | MCU loopback |
| --- | --- | --- | --- |
| VDD | 3.3 V | 3.3 V | |
| GND | Common GND | Common GND | |
| L/R | GND | GND | |
| SD | PB14 | PC12 (CN7 pin 3) | Separate data lines |
| SCK | PB13 | PB13 | PB13 to PC10 (CN7 pin 1) |
| WS | PB12 | PB12 | PB12 to PA4 (Arduino A2) |

The saved Spatial Focus implementation assumes parallel microphones spaced
about 38 mm apart, with the desired listening direction perpendicular to the
line joining them. At zero focus, NLMS instead uses the second microphone as a
noise reference. Nonzero focus blends toward a two-microphone sum and pauses
NLMS cancellation; the controls are not two simultaneous cancellation methods.
Real-room directionality and speech preservation have not been measured.

## Restore and run

Use a checkout of tag Wavelength-v3, or extract source.zip into a separate
directory. Install the app's pinned dependencies with `npm ci` in hearing-app/.
Node.js 24.3+, Windows .NET Framework and STM32CubeProgrammer are needed.

From the repository root, with STM32CubeProgrammer's bin directory on PATH:

```powershell
.\scripts\start-hardware-app.ps1 -Stop
STM32_Programmer_CLI -c port=SWD -d releases/Wavelength-v3/Wavelength-v3.elf -v -hardRst
.\scripts\play-mic.ps1 -ListDevices
.\scripts\start-hardware-app.ps1 -Port COM8 -DeviceIndex 0
```

Open **http://localhost:8081**, refresh an existing browser tab, and choose
**Connect USB**. The browser applies its saved dial settings to the board.
COM8 and Headphone (Realtek(R) Audio), index 0, were used at capture time.
Windows can renumber outputs when the AUX jack is unplugged/replugged; inspect
the device list and select the actual Headphone output if playback is silent.
PC playback gain was 1. The active-settings file preserves the hardware values
for comparison or manual restoration; it does not change browser storage.

The source snapshot excludes this release's binaries to avoid a recursive
archive. When restoring from source.zip, copy the release artifacts into
releases/Wavelength-v3/ before using the flash command above, or build firmware.
The bundled player executable is archival; play-mic.ps1 builds the matching
source into build/pc-mic-player.exe, where the local API expects its telemetry.

Volume, noise-reduction strength, speech-band gain, seven EQ settings, loud-sound
reduction, Spatial Focus and noise relearning are connected to acknowledged
firmware controls. Spatial Focus is a limited blend, not an angular field of
view. Speech gain boosts frequencies rather than detecting speech. The response
graph is illustrative. See audio_passthrough/APP_CONTROL.md for full behavior,
MIC4 packet layout and the local HTTP/serial bridge.

## Build firmware

Use the Arm GNU toolchain and CMake with Ninja or Make. Example with Ninja:

```powershell
$v3Toolchain = (Resolve-Path cmake/arm-none-eabi.cmake).Path
cmake -S audio_passthrough -B build/wavelength-v3 -G Ninja "-DCMAKE_TOOLCHAIN_FILE=$v3Toolchain" -DCMAKE_BUILD_TYPE=Release -DAUDIO_PC_STREAM=ON -DAUDIO_NLMS=ON -DAUDIO_DUAL_DATA=ON -DAUDIO_APP_CONTROL=ON -DAUDIO_SWAP_MIC_INPUTS=OFF -DAUDIO_PIN_PROBE=OFF -DAUDIO_DAC_TEST_TONE=OFF
cmake --build build/wavelength-v3
```

The saved firmware uses 16 kHz sampling, 24-bit I2S microphone samples in 32-bit
slots, 64-frame blocks, 128-tap NLMS, and MIC4 mono PCM16 packets at 921600 baud.

## Verification and known limits

The current firmware build passed. App TypeScript checking, lint and all
25 tests passed. Both microphone receivers and live AUX playback were observed;
the user confirmed this version works. Applied controls and mute were verified
on hardware in the project's earlier test record. At capture time the current
stream had no missing packets, CRC errors, firmware drops, underruns or playback
queue resets. This describes that observed interval, not a lifetime guarantee.

**Intermittent I2S framing errors remain unresolved.** Choose Restart audio
in the app to recover. Physical RESET and restarting the helper may be needed
if the link does not recover. Missing reference clocks are reported explicitly;
voice-only fallback bypasses cancellation. PC stalls have also caused transport
errors in earlier runs. Audible quality, acoustic output levels, real-room noise
attenuation and directionality remain uncalibrated/unmeasured.

This checkpoint preserves the working prototype; it does not claim to resolve
those remaining issues. See audio_passthrough/VALIDATION.md for the full record.
