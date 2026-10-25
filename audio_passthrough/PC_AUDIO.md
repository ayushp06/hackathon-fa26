# Play the STM32 microphone through Windows speakers

Signal path:

```text
INMP441 -> STM32 I2S capture -> USART2 -> ST-LINK USB serial -> Windows speakers
```

The PCM5102A, MAX97220 and external headphones are not needed. Keep the microphone
on 3.3 V/GND, PB13 SCK, PB12 WS, PB14 SD, and L/R grounded. Keep the board's
ST-LINK USB cable connected. This uses the existing ST-LINK virtual COM port,
not USB audio-device firmware on the STM32.

## Start and stop

The board must run the **PC-stream firmware** described below. Close the old
terminal microphone monitor and any other COM8 programs first. From the repository
root in **Windows PowerShell 5.1**:

```powershell
.\scripts\play-mic.ps1 -Port COM8
```

This compiles the included C# player on first use with Windows' .NET Framework;
no Python packages, audio drivers, or downloads are required. It opens the Windows
default playback device and runs until Ctrl+C. Start at low speaker volume and
keep the mic away from speakers to avoid acoustic feedback.

To select the computer speakers explicitly:

```powershell
.\scripts\play-mic.ps1 -ListDevices
.\scripts\play-mic.ps1 -Port COM8 -DeviceIndex 0
```

Device 0 on the tested computer is `Speaker (Realtek(R) Audio)`. Device numbers
can change. `-DeviceIndex -1` selects the Windows default. `-Gain 2` doubles
the playback amplitude with saturation; default gain is 1 and maximum is 8.
Changing gain requires stopping and restarting the player.

For background playback:

```powershell
.\scripts\play-mic.ps1 -Port COM8 -DeviceIndex 0 -Background
.\scripts\play-mic.ps1 -Stop
```

The background process has no visible window. Its PID is saved under `build/`,
and the stop command checks that the PID belongs to this player before stopping
it. Progress is in `build/pc-mic-playback.log`, errors in
`build/pc-mic-playback-error.log`.

A finite playback and WAV recording can be used for verification:

```powershell
.\scripts\play-mic.ps1 -Port COM8 -DeviceIndex 0 -DurationSeconds 8 -RecordPath build/mic-check.wav
```

Recordings require foreground mode. The WAV contains the same resampled,
gain-adjusted PCM submitted to Windows.

## Firmware build

From the repository root, with Arm GCC and Ninja on PATH:

```powershell
cmake -S audio_passthrough -B build/audio-pc -G Ninja "-DCMAKE_TOOLCHAIN_FILE=$PWD/cmake/arm-none-eabi.cmake" "-DCMAKE_BUILD_TYPE=Release" -DAUDIO_PC_STREAM=ON -DAUDIO_DAC_TEST_TONE=OFF -DAUDIO_PIN_PROBE=OFF
cmake --build build/audio-pc
& 'C:\Program Files\STMicroelectronics\STM32Cube\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe' -c port=SWD -d build/audio-pc/AudioPassthrough.elf -v -rst
```

Use `-G "MinGW Makefiles"` if using MinGW Make instead of Ninja, as on the tested
workstation. An existing build directory must retain its original generator.

In STM32CubeIDE, add the compiler symbol `AUDIO_PC_STREAM` and ensure
`AUDIO_DAC_TEST_TONE` and `AUDIO_PIN_PROBE` are absent. The new `pc_audio.c` file
is part of the project. To restore analog DAC playback, build with PC streaming
OFF; to restore the old textual monitor, use that firmware and 115200 baud.

**PC mode uses binary data at 921600 baud.** The old `monitor-mic.ps1` text
monitor cannot share the port or decode this mode. Use the player's level and
health statistics instead.

## Streaming details

I2S remains full duplex internally to generate shared microphone clocks. Its
transmit buffers are zeroed so the external DAC is silent. Capture converts signed
24-bit microphone samples to signed 16-bit mono PCM by dividing by 256. Each
64-sample block covers 4 ms nominally.

A fixed eight-packet queue separates the capture interrupt from serial output.
The capture callback only packs samples and CRC into this queue; it does not call
UART. Foreground sends one packet in about 1.6 ms at 921600 baud, and audio DMA
interrupts preempt it. Bandwidth is about 36.5 kB/s, below the UART's approximately
92 kB/s payload capacity. Text diagnostics are suppressed to preserve framing.

Each 146-byte little-endian packet is:

| Offset | Size | Value |
| --- | --- | --- |
| 0 | 4 | ASCII `MIC1` |
| 4 | 4 | Block sequence number |
| 8 | 4 | Nominal sample rate, 16000 |
| 12 | 2 | Sample count, 64 |
| 14 | 2 | Flags: bit 0 indicates a firmware queue drop has occurred |
| 16 | 128 | 64 signed PCM16 mono samples |
| 144 | 2 | CRC-16/CCITT-FALSE over bytes 0–143 |

Windows validates headers, CRC, and sequence numbers, then submits audio using
WinMM wave output. An initial silent warmup initializes the audio device before
accepting live data. Adaptive linear interpolation compensates for the independent
STM32 HSI and PC audio clock rates, preventing gradual buffer drift. It does not
perform noise cancellation or other microphone processing.

The player reports received packet count, input peak (0–32768), queued audio
milliseconds, resampling ratio, missing/corrupt packets, firmware drops, playback
underruns, and overflow resets. Queue duration is not the total acoustic latency:
Windows and the output device add buffering. During the successful test, queue
duration stayed around 51–59 ms. All error counters should stay at zero.

The prototype uses Windows PowerShell/.NET Framework and WinMM and is intended
for this Windows workstation. A serial timeout, unavailable device, or port
conflict is reported explicitly. It does not create a Windows microphone input
device for other applications.
