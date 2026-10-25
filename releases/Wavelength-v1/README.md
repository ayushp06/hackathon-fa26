# Wavelength-v1

Preserved working baseline: INMP441 left microphone -> STM32F411RE -> ST-LINK
USB serial -> Windows Realtek headphone/AUX output. 16 kHz mono PCM16 at
921600 baud. The user confirmed this path was audible.

- `source.zip`: source and build scripts before NLMS changes.
- `Wavelength-v1.elf`, `.hex`, `.bin`: tested firmware.
- `pc-mic-player.exe`: matching Windows playback bridge.
- `manifest.json`: SHA-256 hashes of these artifacts.

Stop current PC playback before restoring firmware. From the repository root:

```powershell
.\scripts\play-mic.ps1 -Stop
& 'C:\Program Files\STMicroelectronics\STM32Cube\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe' -c port=SWD -d releases/Wavelength-v1/Wavelength-v1.elf -v -rst
.\releases\Wavelength-v1\pc-mic-player.exe --list
.\releases\Wavelength-v1\pc-mic-player.exe --port COM8 --device 0
```

Select the currently enumerated headphone device number. Stop foreground
playback with Ctrl+C. The newer playback script also accepts this baseline's
MIC1 packets. No Git tag was created: this workspace still has no commits and
the environment previously denied Git metadata configuration.
