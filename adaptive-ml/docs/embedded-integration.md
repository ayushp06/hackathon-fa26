# Embedded integration contract

Baseline inspected: main `b29a601`. Firmware owns actual audio processing:
`audio_passthrough/Core/Src/audio.c:process_half` calls `Controls_BeginBlock`,
`Noise_Process`, then `Controls_Process24`; 64 samples / 16 kHz = 4 ms per block.
The current output is MIC4 PCM over USART2 to the Windows player, not the external DAC.
The browser uses HardwareDeviceService -> loopback API -> existing serial-owning
player. Native builds use mocks. No app files will be changed here.

## Confirmed controls and provisional model mapping

`Noise_SetStrength` already applies 0..100 percent cancellation mix with a per-sample
0.002 ramp, aligned delayed dry/estimate, reference and numeric guards. Reuse it through
the Controls settings handoff; do not change mu=0.08 or rebuild the filter.
Model output 0 is absolute NLMS strength / 100, bounded [0,1], baseline 0.5.
Output 1 is unsupported and pinned to 0.5 by equal limits; corrections select output 0 only.
Spatial focus disables NLMS cancellation: preference inference/learning must pause then.

## Features

Use real `NoiseStats.primary_rms` and `.reference_rms` from `Noise_Process` before
subtraction/EQ/volume. Primary is DC-blocked and delayed 32 samples; reference is
DC-blocked. Both are integer RMS amplitude ×32768, not calibrated dB SPL/HL.
Aggregate arithmetic mean of 25 successive block RMS values (100 ms nominal).
This is mean block RMS, not RMS recomputed over concatenated samples.
For each measured level r, use `clamp((log10(max(min(r/32768,1),1e-5))+5)/5,0,1)`.
Silence maps to zero; extreme values saturate; no division by a measured level.
Context = [primary level, reference level, 0.5 unused compatibility constant].
Processed output RMS is never an input. No environment classification is claimed.

## Planned concurrency and behavior

ISR accumulates capped integer RMS and publishes a 100 ms mailbox. Foreground copies
the small mailbox with interrupts briefly masked; no log, inference or training in ISR.
Only new fresh contexts are processed; require several stable windows before recall.
Model is foreground-only; parameters use the existing block-boundary Controls handoff.
Regular app commands, hydration, initialization and intermediate dial movement never
train. Manual strength or legacy bypass pauses autonomous control. Explicit feedback
must refer to a fresh stable context and holds the correction before subsequent inference.
No flash writes; learning is session-only. Reset/enable semantics and debug framing
will be documented with implementation. Option is off by default until bench validation.

## Remaining coordination

App needs a distinct committed correction event, context/time and baseline semantics;
existing setter calls do not convey these. A debug command can use the existing
ten-byte CRC/sequence parser and serial owner's command file without changing PCM.
Hardware timing, I2S3 stability and speech preservation require bench checks; host tests
cannot establish them. No microphone/DAC driver changes are planned.
