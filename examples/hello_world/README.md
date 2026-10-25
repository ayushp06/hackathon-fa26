# NUCLEO-F411RE hello world

This standalone C test blinks green LD2 (PA5) with two seconds on and two seconds
off, and sends once per four-second cycle:

```text
Hello, world! STM32F411RE is running.
```

USART2 TX uses PA2/AF7, routed to the ST-LINK virtual COM port on the Nucleo.
Use 115200 baud, 8 data bits, no parity, 1 stop bit, no flow control.
The connected board was identified as NUCLEO-F411RE, with serial port COM8.

The test uses the 16 MHz internal oscillator and direct peripheral registers.
It has its own minimal startup and needs no CMSIS downloads. The main CMSIS-DSP
project remains available at the repository root.

## Build and upload

From the repository root, with CMake, Ninja, and Arm GNU Toolchain on PATH:

```powershell
cmake -S examples/hello_world -B build/hello_world-ninja -G Ninja "-DCMAKE_TOOLCHAIN_FILE=$PWD/cmake/arm-none-eabi.cmake" "-DCMAKE_BUILD_TYPE=Release"
cmake --build build/hello_world-ninja
& 'C:\Program Files\STMicroelectronics\STM32Cube\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe' -c port=SWD -d build/hello_world-ninja/hello_world.elf -v -rst
```

Alternatively use `-G "MinGW Makefiles"` with `mingw32-make` on PATH.
Uploading replaces the firmware sectors occupied by this test.

## Verified on the connected board

On 2026-10-24, built successfully with Arm GCC 13.3.1, flashed using
STM32CubeProgrammer, and passed its flash readback verification. Three consecutive
hello-world lines were then received from COM8 at 115200 baud.
The image uses 548 bytes of flash and 4 bytes of static RAM, plus stack.

The flashed image is `build/hello_world/hello_world.elf`. The pre-test 512 KiB
flash contents were saved to `build/hello_world/pretest-flash.bin` (ignored by Git).
To restore those contents if needed:

```powershell
& 'C:\Program Files\STMicroelectronics\STM32Cube\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe' -c port=SWD -d build/hello_world/pretest-flash.bin 0x08000000 -v -rst
```
