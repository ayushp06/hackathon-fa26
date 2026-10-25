# Validation on 2026-10-24

## Wavelength-v2 release check on 2026-10-25

The separate-data receiver is now built, flashed and tested on hardware.
Voice SD is PB14, noise SD is PC12, both L/R are grounded, and the shared clock
connections are PB13-PC10 and PB12-PA4. The master starts before the I2S3 slave;
the slave is enabled in a WS-high interval to establish Philips synchronization.

Both microphone inputs produced changing samples and NLMS ran. The latest
five-second retry received 1,269 packets without missing packets, CRC failures,
firmware drops, playback underruns or overflows. Callback maximum was 163,634
cycles (about 1.70 ms at 96 MHz), below the 4 ms block period. Subsequent AUX
playback also showed both inputs and reduced output RMS. These checks do not
measure speech preservation or noise-only attenuation.

Intermittent I2S3 framing errors have stopped capture between short successful
runs. The firmware latches the fault and stops streaming; a board reset is
required. Physical RESET restored streaming when some debugger resets yielded
no packets. The user accepted this limitation for Wavelength-v2. Historical
entries below describe earlier configurations and are not the current wiring.

## Latest NLMS retry and prepared alternative

After the user confirmed both mics were reconnected with opposite L/R settings,
reflashed the shared-SD NLMS build. A six-second playback check received 1,521
valid packets without transport errors. Voice RMS changed, but reference RMS
remained zero, so the filter continued to bypass. Continuous PC headphone
playback was restarted with that build.

Prepared and successfully cross-compiled optional `AUDIO_DUAL_DATA=ON` using
I2S3 slave RX on PC12, PA4 and PC10, with DMA1 Stream0 Channel0 and paired-buffer
ownership checks. It requires separate mic SD wires, both L/R grounded, and clock
loopbacks PB13-PC10 and PB12-PA4. This alternative has not been flashed or tested
on hardware; user choice and completion of the changed wiring are pending.

## Latest recovery: Wavelength-v1 playback restored

After the user reported silence during right-channel isolation, the previous
player log showed both microphone levels zero, then a closed COM port. Restored
the preserved `releases/Wavelength-v1/Wavelength-v1.elf`; flash verification
passed. A four-second playback check on `Headphone (Realtek(R) Audio)` received
1,015 valid packets with changing nonzero peaks (2,686 to 20,456 PCM16 units),
and no packet loss, CRC errors, firmware drops, underruns or overflow resets.
Restarted continuous playback. The board currently runs the original unfiltered
baseline; the NLMS implementation remains in source and `build/audio-nlms/`, but
is not flashed. Both-channel noise cancellation is still unverified.

## NLMS implementation and channel-isolation checks

Preserved Wavelength-v1 as a source archive, flashable firmware, Windows player,
and SHA-256 manifest under `releases/Wavelength-v1/`. Added a CMSIS-DSP 128-tap
NLMS filter, 32-sample primary delay, DC blockers, adaptation guards, fading
bypass, saturation and numeric recovery. Added MIC2 RMS/timing telemetry and
player commands for bypass, enable and reset. Original MIC1 playback was retested
with the new player and had zero transport/playback errors over four seconds.

The deterministic native C test passed correlated-noise convergence, preservation
of an independent desired tone, missing-reference bypass and controls. Its very
high attenuation is an ideal synthetic result, not real-room cancellation evidence.
CMake Release and optimized native STM32CubeIDE Debug builds both passed; the
CubeIDE build reported zero errors and warnings. Flash readback verification passed.

A ten-second live run received 2,532 packets with no missing packets, CRC errors,
firmware drops, playback underruns or overflow resets. Maximum callback cycles
were 158,976 (about 1.66 ms at 96 MHz, under the 4 ms deadline). However, reference
RMS was zero, so the filter bypassed subtraction. Manual bypass was then tested:
the log changed from `no-reference` to `bypass` after the command.

The user confirmed both INMP441s were wired to the shared bus with opposite L/R
levels. An isolation test then disconnected original SD and selected the second
mic as left: changing primary RMS (hundreds of PCM16 units) was observed. With
that second mic alone and L/R moved high, both primary and reference RMS became
zero. This confirms that module can produce left-slot input, but does not yet
establish why right-slot input is absent. A comparison with the original mic
alone selected as right is pending. Real-world noise reduction remains unverified.

## Earlier PC AUX/headphone playback

Built and flashed `AUDIO_PC_STREAM=ON`, with tone and pin probe disabled. Flash
readback verification passed. The C# bridge compiled using Windows PowerShell's
built-in Add-Type and detected `Speaker (Realtek(R) Audio)` as device 0.

After adding an initial silent Windows audio-device warmup, an eight-second
playback test received 2,027 packets with changing, nonzero microphone samples:
zero missing packets, CRC errors, firmware drop flags, playback underruns, or
overflow resets. Reported queued audio was about 51–59 ms. Adaptive resampling
settled around 1.0136 to compensate the independent clocks. This is queue duration,
not a measured end-to-end acoustic latency. An earlier test without warmup had
three startup overflow resets; the revised test had none.

An eight-second WAV was saved to `build/mic-pc-check.wav`. Continuous playback
was then started on device 0 at gain 1. Logs are in `build/pc-mic-playback.log` and
`build/pc-mic-playback-error.log`. The board currently sends microphone PCM over
COM8 at 921600 baud, with the external DAC output silent. The user confirmed
audible computer playback. After connecting the computer's 3.5 mm jack, Windows
exposed `Headphone (Realtek(R) Audio)` as device 0 and speakers as device 1.
Restarted the bridge on the headphone endpoint. The first five reports showed
zero missing packets, CRC errors, firmware drops, underruns, or overflow resets.
Firmware and microphone wiring were unchanged during this output switch.

## Earlier isolated DAC test

Restored and reflashed the steady 250 Hz, approximately -30 dBFS diagnostic
with the pin probe disabled, to measure DAC analog output independently of
microphone level and amplifier loading. Build and flash verification passed.
The board currently sends a test tone to the DAC; the terminal monitor still
reports microphone capture statistics. Analog conversion remains unverified
pending direct DAC output measurements.

## Earlier live microphone monitor

Rebuilt and reflashed microphone passthrough with both diagnostic options OFF.
Firmware now reports at 100 ms intervals and retains the maximum capture peak
between reports. Flash verification passed. Tested `scripts/monitor-mic.ps1` on
COM8 for four seconds: live level bars and changing samples were displayed,
with all reported error and fault counts zero. During this check the board output
microphone audio to the DAC, with the continuous test tone disabled.

## Earlier multimeter diagnostic

After the user connected amplifier power to the STM32 board's 5 V output, built
and flashed the continuous 250 Hz, approximately -30 dBFS tone diagnostic.
Flash verification passed, startup confirmed the diagnostic mode, and live
DMA/I2S errors remained zero. Microphone capture is still active and changing,
but **the board currently outputs the test tone instead of microphone audio**.
The DAC's expected unloaded analog tone level is approximately 66 mV RMS,
calculated from its nominal 2.1 V RMS full-scale output, not measured here.
Actual DAC and amplifier analog voltages await user multimeter measurements.
Log: `build/audio-tone/multimeter-test.txt`.

## Latest result after correcting microphone wiring

Rebuilt and uploaded normal passthrough with `AUDIO_PIN_PROBE=OFF` and
`AUDIO_DAC_TEST_TONE=OFF`. Flash readback verification passed. The board ran
microphone passthrough during this check. Eight consecutive one-second reports showed
changing, nonzero left-channel samples, about 16,000 additional nonzero samples
per second, and zero samples in the unused right slot. All sync, deadline, DMA,
overrun, underrun, framing, stall, and clipping counts remained zero.

Example live report:

```text
rx=1503 tx=1503 nz=96191 rnz=0 change=96181 sample=495236 peak=752206 clip=0 cycles=3704 sync=0 late=0 dma=0 ovr=0 udr=0 fre=0 stall=0 hal=0x0 fault=0 ndtr=132/130
```

Capture is now verified as nonzero and changing. Both DAC channels receive the
same microphone signal. Audible headphone output still requires user confirmation.
Latest serial capture: `build/audio/rewired-microphone-check.txt`.

## Earlier checks and troubleshooting history

Hardware: connected NUCLEO-F411RE, ST-LINK, USART2 virtual COM8, about 3.24 V
reported by ST-LINK. User reported the microphone and DAC were wired and powered.

Completed checks:

- Native STM32CubeIDE 1.19.0 headless managed Debug build, Arm GCC 13.3.1:
  successful after providing bare-metal newlib stubs. Final linker layout gives
  separate flash and RAM program segments.
- CMake Release build using the same Arm compiler: successful.
- Host C tests for positive/negative 24-bit extrema, sign extension, padding
  discard, stereo duplication, gain, and positive/negative saturation: passed.
- STM32CubeProgrammer download and readback verification: passed.
- Both DMA engines advanced continuously at about 250 blocks/s. RX/TX NDTR
  differed by two halfwords, consistent with the transmitter leading reception.
- No reported sync, deadline, DMA, I2S overrun, underrun, framing, or stall errors
  in the collected normal-stream logs. Peak callback time was about 2,477 CPU
  cycles (26 microseconds at 96 MHz), within the 4 ms processing budget.

Live firmware configuration:

```text
GPIOB MODER=0xaa000280 AFRH=0x56550000 PUPDR=0x20000100
I2S TX=0x0e03 RX=0x0d03 DIV=0x0019 CLK=51200000
```

Normal streaming reported `nz=0 rnz=0 change=0 peak=0`: no valid microphone
signal was observed in either channel. Audible speech and stereo analog playback
therefore remain unverified.

Optional GPIO probe result:

```text
pull=DOWN reads=100000 bck_edges=32014 ws_edges=504 sd_edges=0 sd_high=0
pull=UP   reads=100000 bck_edges=32013 ws_edges=504 sd_edges=1081 sd_high=99030
```

This confirms clock activity at MCU pads and shows SD responding primarily to
weak pulls, consistent with an undriven data input. It does not prove continuity
to the microphone, identify a failed component, or establish electrical timing
quality. Diagnostic pull-up caused temporary nonzero samples; those are not
evidence of captured audio. Restore the default probe-disabled firmware for use.

After the user power-cycled the microphone and confirmed PB14 wiring, another
normal-stream check still reported zero samples in both channels. A separate
`build/audio-tone/` diagnostic was then built, flashed, and verified. It sends
a quiet 1 kHz sine for one second on/one second off to both channels while keeping
microphone capture active. Startup confirmed `DAC TEST`, and DMA/I2S error counts
remained zero. Audibility is awaiting the user's listening check. **The board
currently runs this tone diagnostic**, not microphone playback. The ordinary
passthrough image remains in `build/audio/AudioPassthrough.elf`.

The user could not hear the initial -48 dBFS diagnostic tone. The diagnostic
was subsequently raised to about -30 dBFS and reflashed with the optional GPIO
probe. PB15 showed 3,790 transitions during the first 100,000-read probe, while
PB13 and PB12 also showed clock activity. This confirms activity at the MCU's
DAC data output pad, not successful reception or analog output at the DAC.
PB14 still followed the weak pulls. The current tone build includes the one-time
pin probe; its temporary nonzero input counts are artificial and must be ignored.
Playback audibility after the level change was not established in this check.

Reproduce the host test from the repository root with native GCC:

```powershell
gcc -std=c11 -Wall -Wextra -Werror tests/audio_sample_test.c -o build/audio_sample_test.exe
.\build\audio_sample_test.exe
```

Logs and build artifacts are under `build/` and are ignored by Git. This is a
record of finite checks, not a claim of long-duration glitch-free audio operation.
