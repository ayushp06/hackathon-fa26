# Live companion-app controls

The browser app controls the connected STM32 over the existing ST-LINK USB
serial connection. Windows plays its processed PCM through the selected AUX
device. No Bluetooth radio or external DAC/amplifier is required for this path.
The preserved Wavelength-v2 release remains unchanged.

## Run on this Windows PC

Install Node.js 24.3+ and install the app dependencies once with `npm ci` inside
`hearing-app/`. From the repository root:

```powershell
.\scripts\start-hardware-app.ps1 -Port COM8 -DeviceIndex 0
```

Open **http://localhost:8081**, finish or resume the app setup, and choose
**Connect USB**. The connection applies saved settings, temporarily muting while
EQ is synchronized and restoring the saved volume last. Browser dials then send
real commands; the connection panel shows live voice, reference and output RMS.
Disconnect mutes the device. Native/mobile builds retain explicitly labeled
mock controls; the implemented transport is the browser on the USB-connected PC.

The script starts the audio player, loopback API on 127.0.0.1:8765, and Expo web
server. `-NoWeb` starts only the audio/API helpers if Expo is already running.
`-Stop` stops the managed helpers and playback. Logs and process records are
under `build/`; normal `play-mic.ps1` still works independently. Only one program
can own COM8 at once. If the board reports an I2S synchronization fault, choose
**Restart audio** in the app to reset the board and reapply saved controls. If
that cannot restore the link, press physical RESET and rerun this script. Do not
open the serial monitor concurrently.

## Actual control behavior

| App control | STM32 processing |
| --- | --- |
| Volume | Linear gain: 0 mutes, 50 is half amplitude, 100 is unity |
| Reduce Loud Sounds | 0 bypasses; 100 blends fully into a 4:1 peak-envelope compressor above -18 dBFS (5 ms attack, 100 ms release) and lowers the instantaneous digital peak ceiling to -12 dBFS |
| Background Noise Reduction | NLMS estimate subtraction mix, 0–100%, smoothed |
| Speech Amplification | Broad 2 kHz peaking filter, 0–12 dB; boosts frequencies, not speech recognition |
| Bass | 125 Hz low shelf, -12 to +12 dB |
| Mid | 1 kHz peaking EQ, -12 to +12 dB |
| Treble | 4 kHz high shelf, -12 to +12 dB |
| 250/500/2000/4000 Hz points | Independent peaking EQ, -12 to +12 dB |
| Relearn noise | Reset NLMS coefficients; stay quiet with background noise present for about two seconds |
| Spatial Focus | 0 uses the primary microphone and NLMS; 1–100 blends toward equal-weight broadside delay-and-sum processing, disabling NLMS adaptation and cancellation to preserve shared speech |

Spatial Focus assumes two matched microphones about 38 mm (1.5 inches) apart,
facing the same way, with their joining line perpendicular to the desired
listening direction. Both captured channels share the same 32-sample processing
delay. The focus percentage controls the blend, not an angle in degrees. A
two-microphone sum also has a rear lobe and weak directionality at low frequencies;
it cannot produce an arbitrary hearing field of view or distinguish front from
back. Missing reference signal smoothly restores primary-only audio. Synthetic
plane-wave tests at 4 kHz give 15.18 dB side attenuation at the stated spacing;
room performance and microphone matching have not been measured. Turn focus
back to zero to relearn/cancel a separately placed noise reference.

Compression follows EQ and speech enhancement, before volume. The digital peak
ceiling follows volume, so low volume still reduces compressed audio. It catches
transients immediately without lookahead; strong transients can distort. This
controls PCM amplitude, not calibrated headphone sound pressure. No makeup gain
is applied. Loudness and spatial controls default to zero on firmware reset.

At 16 kHz sampling, 8 kHz is Nyquist. The graph's upper Treble control therefore
uses a 4 kHz shelf rather than a peaking filter centered at 8 kHz. The frequency
graph remains an illustrative editor, not a measured transfer function or live
spectrum. Noise relearning does not calibrate hearing or determine dB HL.
EQ changes preserve filter history and smooth coefficients; volume ramps over
up to 20 ms. Output saturates to signed 24-bit before PCM16 conversion. Large
combined boosts can clip, so the telemetry includes a latched clip indicator.

Noise reduction needs both microphones and the shared-clock jumpers documented
in NLMS.md. If reference WS is absent at startup, this app-control build keeps
voice capture and the other controls running with cancellation bypassed; the
app explicitly reports the missing noise clock. Reset after repairing the
clock connection to enable dual capture. Running receivers still stop on framing,
overrun, deadline or buffer synchronization errors; they never silently combine
unpaired blocks. Intermittent hardware synchronization remains a known limit.

## Firmware build

Use the same GNU Arm toolchain and CMake setup as NLMS, adding
`-DAUDIO_APP_CONTROL=ON`. Example from the repository root with Ninja:

```powershell
$appToolchain = (Resolve-Path cmake/arm-none-eabi.cmake).Path
cmake -S audio_passthrough -B build/audio-app -G Ninja "-DCMAKE_TOOLCHAIN_FILE=$appToolchain" -DCMAKE_BUILD_TYPE=Release -DAUDIO_PC_STREAM=ON -DAUDIO_NLMS=ON -DAUDIO_DUAL_DATA=ON -DAUDIO_SWAP_MIC_INPUTS=OFF -DAUDIO_APP_CONTROL=ON
cmake --build build/audio-app
```

Flash `build/audio-app/AudioPassthrough.elf` with STM32CubeProgrammer. The PC
script compiles the updated C# player with Windows .NET Framework libraries.
The implementation uses I2S DMA plus USART2 TX DMA1 Stream6 Channel4. A short
priority-0 USART RX interrupt queues commands while the DSP callback runs.
PCM buffers stay owned until UART transmission completes. Telemetry file I/O
runs on a PC background writer, outside the playback loop.

## Serial protocol

App commands are ten bytes: `A5 5A id value sequence[4] CRC[2]`. Sequence and CRC
are little endian. CRC16-CCITT-FALSE covers the first eight bytes. `value` is a
signed int8. IDs 0–9 are Volume, Noise Reduction, Speech Amplification, Bass,
Mid, Treble, 250 Hz, 500 Hz, 2 kHz, 4 kHz. ID 10 with value zero resets NLMS.
Duplicate sequences do not repeat filter resets. ID 11 with value zero requests
an explicit board reset. The bridge sends it once, and the API waits for fresh
streaming boot telemetry before the app reconnects and restores settings.
The receiver discards bad CRCs and
times out partial commands. Legacy `b`, `n`, `r` console commands remain accepted.
IDs 12 and 13 set Reduce Loud Sounds and Spatial Focus respectively (0–100).
The loopback API exposes `reduceLoudSounds` and `spatialFocus` with MIC4 firmware;
MIC3 retains its original ten controls.

`MIC4` packets contain 186 bytes. Offsets 0–51 retain the MIC3 layout. The 56-byte header adds:

| Offset | Field |
| --- | --- |
| 32–35 | Last applied command sequence, uint32 |
| 36–45 | Applied values for controls 0–9, int8 |
| 46 | Last command status: 0 accepted, 1 invalid |
| 47 | Reference receiver running, 0/1 |
| 48–51 | Relearn request count, uint32 |
| 52 | Applied Reduce Loud Sounds value, 0–100 |
| 53 | Applied Spatial Focus value, 0–100 |
| 54 | Spatial processing requested with a present reference signal, 0/1 |
| 55 | Nominal microphone spacing, 38 mm |
| 56–183 | 64 mono PCM16 samples |
| 184–185 | CRC16 over preceding bytes |

The output RMS at offset 24 includes runtime EQ and volume. Controls are applied
at an audio block boundary before acknowledgment appears in a PCM packet.
The local API returns success only after seeing the requested sequence and a
successful firmware status, not merely after writing a command. The player
retains MIC1/MIC2/MIC3 compatibility; extended controls require MIC4.

The Node API publishes one command at a time through an atomic file in build/;
the sole serial-owning C# player sends it and publishes the latest firmware
telemetry. Stale/faulted telemetry marks the connection unavailable. The server
binds only 127.0.0.1 and accepts browser origins localhost:8081 and
127.0.0.1:8081. It rejects unsupported controls and out-of-range values. The
browser coalesces fast dial changes and does not claim hardware application
while disconnected. This service is intended only for this local development PC.

## Checks

Run app typecheck/lint/tests from hearing-app/, and
`node --test tests/hardware_server.test.mjs` from the root. Native
`tests/audio_controls_test.c` checks all seven EQ gains, speech boost, mute,
applied values, invalid commands and idempotent resets against the firmware DSP.
See VALIDATION.md for live board and browser results.

With MIC4 playback already running and the app idle, run
`.\scripts\check-dsp-hardware.ps1` to check all twelve acknowledged controls,
spatial activation and mute, then restore the initial settings. It writes
`build/dsp-hardware-check.json`. Do not move app dials during this check.
For quiet testing, the app launcher accepts `-Gain 0.25` as a PC-side gain;
this is separate from the firmware Volume dial.

Filter coefficients follow the [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/).
