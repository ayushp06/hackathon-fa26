# STM32F411RE microphone passthrough

INMP441 -> STM32F411RE I2S2 full duplex -> PCM5102A -> MAX97220 -> headphones.
C and STM32 HAL, with 64 frames per block. No audio algorithms or DSP library
are needed for this application. The original hello-world and CMSIS-DSP projects
remain separate.

To bypass the external DAC/amplifier and play directly through the computer's
speakers over ST-LINK USB serial, use [PC speaker playback](PC_AUDIO.md).

The working baseline is archived as [Wavelength-v1](../releases/Wavelength-v1/README.md).
For the new two-microphone adaptive filter, see [NLMS noise reduction](NLMS.md).

## Wiring: PB14 is supported, no move to PC2 required

The STM32F411 datasheet **DS10314 Rev 8, Table 9, pages 49–50** lists:

| Signal | MCU pin | Alternate function |
| --- | --- | --- |
| WS to microphone and DAC LCK | PB12 | AF5, I2S2_WS |
| BCK to microphone SCK and DAC BCK | PB13 | AF5, I2S2_CK |
| Microphone SD into MCU | **PB14** | **AF6, I2S2ext_SD** |
| MCU output to DAC DIN | PB15 | AF5, I2S2_SD |
| Alternative receive pin, unused | PC2 | AF6, I2S2ext_SD |

PB14 AF5 is SPI2_MISO; **AF6** is the required extended I2S receiver.
RM0383 section 20.4.2 describes I2S2 master TX with I2S2ext slave RX sharing
the same clocks internally. PB14 receive and PB15 transmit work simultaneously.
Configuring SPI2 as ordinary full-duplex SPI would not implement this I2S bus.

Keep microphone VDD at 3.3 V, GND common, and L/R at GND (left channel).
Keep DAC SCK grounded for its BCK PLL mode. The DAC breakout must select I2S
format (FMT low) and be unmuted (XSMT high); check its existing straps. Use the
module-supported DAC and amplifier supplies. MCU pins carry digital audio only;
DAC analog L/R feed the amplifier inputs. Begin listening at low amplifier volume.

## Open and build in STM32CubeIDE

Use **File -> Import -> General -> Existing Projects into Workspace**, select
this `audio_passthrough` directory, and import **AudioPassthrough**. Build Debug
or Release and use the ST-LINK debugger/download configuration for STM32F411RE.
The `.project` and `.cproject` files define a native managed GCC project.
An `.ioc` generator file is not required; all initialization code is included.

This project vendors the required STM32CubeF4 V1.28.3 HAL/CMSIS files and
licenses, so it does not need package downloads or paths to another workstation.
The Eclipse metadata was adapted from ST's STM32CubeF4 GCC project template.
See `Drivers/Package_license.md` and component license files.

## CMake build and flash

From the repository root, with Arm GNU Toolchain and Ninja on PATH:

```powershell
cmake -S audio_passthrough -B build/audio-ninja -G Ninja "-DCMAKE_TOOLCHAIN_FILE=$PWD/cmake/arm-none-eabi.cmake" "-DCMAKE_BUILD_TYPE=Release"
cmake --build build/audio-ninja
& 'C:\Program Files\STMicroelectronics\STM32Cube\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe' -c port=SWD -d build/audio-ninja/AudioPassthrough.elf -v -rst
```

With `mingw32-make` available, `-G "MinGW Makefiles"` works too. The build tested
on this workstation is in `../build/audio/`. CMake also produces HEX, BIN, and MAP.
BIN flash address is `0x08000000`. Flashing replaces the occupied firmware sectors.

## Clock, buffers, and conversion

- CPU 96 MHz from HSI: 16 MHz / PLLM 16 * PLLN 192 / PLLP 2.
- APB1 48 MHz, APB2 96 MHz.
- F411's independent PLLI2SM 16, PLLI2SN 256, PLLI2SR 5 give I2S 51.2 MHz.
- MCLK disabled, I2SDIV 25, ODD 0: BCK 1.024 MHz, WS nominally 16 kHz.
  Absolute frequency follows the HSI oscillator tolerance.
- Philips I2S, 24-bit data, 32-bit channel slots, stereo: 64 BCK clocks/frame.
- RX: DMA1 Stream3, Channel3, I2S2ext DR -> memory.
- TX: DMA1 Stream4, Channel0, memory -> SPI2 DR.
- Both DMA streams use circular mode, halfword transfers, direct mode, and very
  high DMA priority. DMA IRQs have priority 1; peripheral errors have priority 0.
- Each RX/TX ring contains 128 stereo frames = 512 halfwords. Each completed
  half contains 64 frames = 4 ms. The 24/32-bit HAL API doubles `Size` internally:
  pass **256 channel samples**, not 512 halfwords.

Each frame is `[left_hi16, left_lo16, right_hi16, right_lo16]`. The left sample
is assembled MS-halfword first, the bottom eight padding bits are discarded,
and bit 23 is sign-extended. Unity gain uses a saturating 24-bit conversion.
The signed result is left-aligned in each 32-bit output slot and duplicated L/R.
`AUDIO_GAIN_NUM` and `AUDIO_GAIN_DEN` in `Core/Inc/audio.h` control the fixed gain.

RX half/full callbacks refill the same TX half only after both DMA engines have
left it. Playback occurs on its next ring pass: approximately **8 ms of firmware
buffering**, plus microphone and DAC filter delays. The initial TX buffers are
silent, with 256 ms startup settling. There are no allocations, UART calls, or
blocking delays in the audio callbacks.

The callbacks check alternating half order, RX and TX NDTR positions, elapsed
service interval, and processing duration. I2S overrun/underrun/frame errors,
DMA errors, or a >100 ms stream stall stop the stream and latch a fault. Reset
after correcting the cause. This avoids silently replaying corrupted buffer data.

## Serial diagnostics

ST-LINK virtual COM port: **COM8 on the tested board, 115200 8N1**, no flow
control. Serial port numbers can change. Initialization and start messages appear
after reset. Live GPIO alternate-function registers and I2S registers are printed.
Every 100 ms, foreground code reports:

| Field | Meaning |
| --- | --- |
| `rx`, `tx` | Completed receive blocks and verified transmit half boundaries; about +250/s |
| `nz`, `rnz` | Cumulative nonzero samples in left/right microphone slots |
| `change` | Cumulative changes in captured left samples |
| `sample`, `peak` | Last signed left sample, maximum peak since the previous report |
| `clip`, `cycles` | Saturated samples and maximum callback CPU cycles |
| `sync`, `late` | Half ownership/order errors and missed deadlines |
| `dma`, `ovr`, `udr`, `fre` | DMA, receive overrun, transmit underrun, framing errors |
| `stall`, `hal`, `fault` | Stall count, HAL error bits, latched fault code |
| `ndtr` | RX/TX remaining halfword transfers |

`g_audio_stats` is also available in the debugger. Pausing the CPU during live
streaming can cause a deliberate deadline fault. Fault codes are in `audio.h`.
Green LD2 toggles every second during streaming and stays on after a fault.

From the repository root, open the live terminal level meter:

```powershell
.\scripts\monitor-mic.ps1 -Port COM8
```

It displays a level bar, digital peak dBFS, samples/s, changing samples/s, and
error counts. Press Ctrl+C to stop and release the serial port. Only one monitor
can open COM8 at a time. Use `-Raw` for original firmware lines, or
`-DurationSeconds 10` for a finite recording in the terminal. Digital dBFS is not
a calibrated acoustic dB SPL measurement. The first rate reading is zero until
two reports have arrived; subsequent rates use PC arrival timing and can jitter.

With a grounded L/R pin, `nz` and `change` should increase with real microphone
input. `rnz` may remain zero because the microphone releases the right slot.
DMA progress alone does **not** establish that the microphone or analog chain works.

## Optional check without an oscilloscope

Enable a one-time foreground GPIO activity test:

```powershell
cmake -S audio_passthrough -B build/audio-ninja -DAUDIO_PIN_PROBE=ON
cmake --build build/audio-ninja
```

Flash and reset. After 500 ms, it samples PB12/PB13/PB14 while I2S and DMA keep
running. It compares PB14 under weak internal pull-down and pull-up, then restores
pull-down. It never drives SD as an output. Counts show pad activity, not calibrated
frequency, remote microphone-pin continuity, voltage levels, or signal quality.
An undriven SD input follows the weak pulls; a functioning microphone should drive
valid data during its selected channel. The pull-up diagnostic deliberately changes
captured data, so ignore its nonzero sample counters and reset into a normal build
before judging audio. Disable with `-DAUDIO_PIN_PROBE=OFF`.
In CubeIDE, the equivalent is adding/removing the `AUDIO_PIN_PROBE` compiler symbol.

## Validation and current hardware result

To isolate the DAC/amplifier/headphones from microphone input, configure a
separate build with `-DAUDIO_DAC_TEST_TONE=ON`. It transmits the same continuous
250 Hz stepped sine (about -30 dBFS) to both DAC channels. Microphone capture
and counters continue, but microphone audio is replaced. The option defaults to
OFF. The equivalent CubeIDE symbol is `AUDIO_DAC_TEST_TONE`. Hearing the beep
validates the playback path; the DAC power LED alone does not. Restore a build
with this option OFF for microphone passthrough.

See [VALIDATION.md](VALIDATION.md) for builds, unit checks, and observed board
behavior. After the user corrected microphone wiring, the normal passthrough
firmware was rebuilt, flashed, and verified. The microphone now supplies changing,
nonzero left-channel samples at about 16,000 samples/s, with zero samples in the
unused right channel and no reported stream errors. The tone and pin probe are
disabled. Audible headphone playback still requires a listening check; capture
success alone does not establish the DAC/amplifier output. PC2 is an optional
alternative, not a required pin correction.

## Primary references

- [ST STM32F411 datasheet DS10314, Table 9](https://www.st.com/resource/en/datasheet/stm32f411re.pdf)
- [ST RM0383, Table 27 and section 20.4](https://www.st.com/resource/en/reference_manual/dm00119316-stm32f411xce-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)
- [TDK INMP441 datasheet: I2S data interface](https://invensense.tdk.com/wp-content/uploads/2015/02/INMP441.pdf)
- [TI PCM5102A datasheet: BCK PLL and I2S format](https://www.ti.com/lit/ds/symlink/pcm5102a.pdf)
