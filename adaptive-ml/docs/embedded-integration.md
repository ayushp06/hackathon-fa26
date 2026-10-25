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

## Implemented concurrency and behavior

ISR accumulates capped integer RMS and publishes a 100 ms mailbox. Foreground copies
the small mailbox with interrupts briefly masked; no log, inference or training in ISR.
Only new fresh contexts are processed: three windows within 0.03 normalized units
per feature, no gap over 250 ms. Contexts older than 250 ms, silent inputs, missing
reference and spatial mode cannot infer or train. Radius is 0.15 normalized RMS distance.
Model is foreground-only; parameters use the existing block-boundary Controls handoff.
Regular app commands, hydration, initialization and intermediate dial movement never
train. Manual strength or legacy bypass pauses autonomous control. Explicit feedback
must refer to a fresh stable context and holds the correction before subsequent inference.
No flash writes; learning is session-only. `AUDIO_ADAPTIVE_ML` is OFF by default and
requires APP_CONTROL, NLMS and PC_STREAM. Enabling it initializes baseline strength
50 and autonomous inference; an ordinary strength setter pauses it without training.
Use CMake for this experiment; existing CubeIDE configuration remains unchanged.
The foreground duration including normalization/inference is counted by DWT in
`g_adaptive_stats.inference_max_cycles`; it includes IRQ preemption. Audio callback
timing/deadline guards remain intact. No target measurements exist yet.

## Remaining coordination

The app now sends a distinct confirmed correction through ID14 using the existing
ten-byte CRC/sequence parser and serial owner's command file without changing PCM.
Context/time alignment and calibrated baseline semantics remain pending;
ordinary setter calls do not convey feedback. See app-feedback-contract.md.
Hardware timing, I2S3 stability and speech preservation require bench checks; host tests
cannot establish them. No microphone/DAC driver changes are planned.

## Explicit correction protocol (experimental build only)

Reuse the existing `A5 5A id value sequence[4] CRC16[2]` parser, not a second parser.
Reserve ID 14 = committed preferred strength 0..100; ID 15 = autonomy 0/1;
ID 16/value 0 = clear examples and disable autonomy, preserving current audio setting.
Only ID 14 trains. It requires a nonzero unique sequence and a fresh stable context,
live reference, no fault, and zero spatial focus. It selects only model output 0.
Rejected events do not train or change strength. Retry deduplication preserves the
last command result and last accepted feedback sequence; this is not a persistent
event ledger. Do not replay arbitrary historical commands or reuse sequence IDs.

A successful correction publishes strength at the next audio block and enables
autonomy, with a two-second hold before inference can change it. It does not change
the baseline or NLMS mu. Regular control ID 1, and legacy b/n, pause autonomy; no
setter or hydration trains. ID 15 enables recall again. Spatial mode suspends it.
The existing sequence/status bytes in MIC4 acknowledge these debug commands; PCM
format/length/CRC are unchanged. Invalid status=1; accepted=0. No text is emitted.
Debugger-only `g_adaptive_stats` contains context, examples, counters and maximum
foreground inference/update cycles. App UI has no adaptive-mode or feedback affordance.

The helper uses the existing player command file; it never opens the COM port.
Keep the app/API idle while running it. Concurrent app writes are not serialized with
this debug helper. It refuses an existing command and waits for firmware acknowledgment.
Context is the latest stable 100 ms window, not a timestamp supplied by the user;
this firmware demo therefore requires a stationary scene during correction. Context-ID
and perceptual-latency alignment remain app protocol work.

## Build and live demonstration

No hardware was flashed or tested during implementation. An Arm GCC/CMake toolchain
was not found in this environment, so the following target build remains a required check:

```powershell
$toolchain = (Resolve-Path cmake/arm-none-eabi.cmake).Path
cmake -S audio_passthrough -B build/audio-adaptive -G Ninja "-DCMAKE_TOOLCHAIN_FILE=$toolchain" -DCMAKE_BUILD_TYPE=Release -DAUDIO_PC_STREAM=ON -DAUDIO_NLMS=ON -DAUDIO_DUAL_DATA=ON -DAUDIO_APP_CONTROL=ON -DAUDIO_ADAPTIVE_ML=ON
cmake --build build/audio-adaptive
```

Use a separate build directory; no existing image or preserved release is overwritten.
CubeIDE defaults do not enable this experiment. Coordinate flashing with the hardware
owner, then use the existing `scripts/play-mic.ps1` serial-owning MIC4 player at low
PC playback gain. The browser is optional. As of app main 7f13e6e, hydration,
connect and profile restoration do not replay strength setters or train; ordinary
dial adjustments still pause autonomy. See two-context-demo.md for current app steps.

1. Confirm stable capture, reference clock/signal, spatial=0, no faults/clips, and
   `maxCycles < 384000` at 96 MHz. Reset after wiring changes if necessary.
2. Stay quiet for the existing NLMS training period. Hold the acoustic scene steady
   at least 300 ms, then run `scripts/adaptive-feedback.ps1 -Action correct -Strength 75`.
3. Confirm success and applied noiseReduction=75 in `build/hardware-status.json`;
   debugger should show corrections=1, examples=1. Wait beyond the two-second hold.
4. Move to a sufficiently different level context for at least 300 ms: unknown context
   should return near baseline 50. Return to the original context and observe recall
   near 75. This learner distinguishes levels, not semantic scene labels.
5. `-Action disable` pauses inference; ordinary noise dial writes also pause it.
   `-Action enable` resumes; `-Action clear` clears RAM examples and pauses.
6. Capture foreground DWT maxima plus audio `maxCycles`, fault/drop/clip counts and
   output levels under load. The policy is independent of the app, but playback still
   uses the PC path. Reboot loses examples. Do not claim hearing benefit from this demo.

## Verification and resource findings

From `adaptive-ml/`, run `make test evaluate test-dsp benchmark`. All are host-only.
`test_dsp_loop.c` runs the real NLMS and Controls code: synthetic correlated inputs
produce baseline strength 50, explicit correction 90, unknown fallback 50 and recalled
90. Corrected/recalled output-energy ratios versus baseline were 0.0405/0.0406; these
are ideal synthetic signals, not real-room attenuation or speech preservation.
The handoff test covers delayed boundary publication, invalid/stale events, replay,
manual precedence, masking and missing contexts. Existing sample, NLMS, EQ/compressor,
spatial and Node bridge regression tests pass. Address/undefined-behavior sanitizer
checks pass on the host correction/handoff path; this does not simulate IRQ timing.

Host GCC 15.2: model=432 bytes, policy wrapper=472; new adapter storage totals 560
bytes before linker padding. With 32-bit size_t/float/int the corresponding estimate
is model=420, wrapper=460 and adapter total about 548 bytes; verify in the target map.
No heap or flash writes. Added target flash/stack use is unmeasured. Reuse of existing
log10f/lroundf/math libraries can affect link size; compare adaptive OFF/ON images.
Host benchmark (200,000 calls, 16 examples) observed about 0.070 us prediction and
0.012 us masked update per call; reruns vary and exclude target IRQ/cache/math costs.
These are not STM32 timing estimates. Foreground DWT counters include normalization
and IRQ preemption; audio ISR retains its existing 4 ms fault guard. Only capped
integer sums/divides and mailbox stores were added per block; preservation of the
deadline on hardware is not established until the bench check above.
