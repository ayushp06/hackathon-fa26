# Interface proposal — not an agreed team contract

## Status

CONFIRMED (reviewed `origin/main` at `803033a`; these upstream files are not yet
in this feature branch): app transport remains mocked in
`../../hearing-app/src/device/deviceService.ts`. `src/device/types.ts` and
`src/state/manualValues.ts` under that app define volume, noise reduction, spatial
focus, speech amplification and seven EQ bands. These app values are not adopted
as learner dimensions and do not establish working firmware controls.

Firmware now exists under `../../audio_passthrough/`. `Core/Src/audio.c`:
`process_half` handles 64-frame blocks at nominal 16 kHz in DMA callbacks.
`Core/Src/noise_filter.c`: `Noise_Process` implements NLMS and computes digital
primary/reference/output RMS, exported through `NoiseStats` and MIC2 serial packets.
Runtime controls are only `Noise_SetEnabled` and `Noise_RequestReset`, invoked by
`Core/Src/pc_audio.c`: `PC_Audio_Poll` for commands b/n/r. There is no continuous
runtime parameter setter or normalized ML context contract. NLMS coefficient
adaptation is distinct from user preference learning.

`../../releases/Wavelength-v2/manifest.json` selects dual separate-data microphones
and PC serial playback; the DAC is silent in that configuration. Its README and
`audio_passthrough/VALIDATION.md` record short hardware checks and intermittent
I2S3 framing faults, not sustained reliability or measured hearing benefit.
Older `../../docs/hardware_architecture.md` describes a single-mic design;
`docs/pin_mapping.md` assigns PA4 to encoder push while v2 uses PA4 for I2S3 WS.
Resolve the wiring with the hardware owner before integration. No shared files are edited.

## Proposed module contract

All following fields are PROPOSED, not agreed with DSP/app owners:

CONFIRMED module implementation: `../include/preference.h` currently fixes 3 features,
2 outputs and 16 examples; `pl_init`, `pl_predict`, `pl_correct`, `pl_correct_masked`, `pl_reset` and
`pl_set_baseline` implement the module-side operations below. Their adoption as a
team integration interface remains PROPOSED. Array lengths are caller obligations.

- Acoustic context: fixed compile-time feature count; finite normalized values [0,1].
  Each dimension must eventually have a versioned name, scaling and missing-data rule.
  Invalid/missing contexts are rejected; no fabricated values or dB measurements.
- Baseline: individual finite normalized absolute parameter vector [0,1], supplied by
  caller and within configured per-dimension limits. It is not inferred from silence.
- Prediction: absolute bounded parameter vector plus signed adjustment relative to
  baseline and familiarity [0,1]. Weight sums, similarity attenuation and baseline
  fallback are independent per output and use only corrections for that output.
  Scalar familiarity is the maximum across outputs, not all-output confidence.
  Dimensions are abstract and continuous, not presets.
- Correction: explicit context + absolute preferred parameter vector + per-output
  unsigned-char mask (`PL_OUTPUTS` entries, nonzero means explicitly corrected).
  `pl_correct_masked` ignores unselected target entries, rejects invalid selected
  entries and null/empty masks without mutation. Stored `pl_example.corrected`
  records supervision. Duplicate contexts merge only selected outputs; FIFO eviction
  clears all prior masks in the replaced slot. `pl_correct` remains full-vector
  supervision, equivalent to an all-selected mask. No interaction is not feedback.
- Inference is read-only; updates, baseline changes and reset are separate operations.
  Reset clears examples, preserving configuration/baseline. Baseline replacement clears
  examples to prevent mixing personal configurations. Model storage is caller-owned.
- Fixed capacity, FIFO replacement; no allocation. Public state supports inspection.
  No binary persistence format or thread safety guarantee; caller serializes access.

## BLOCKED integration details

Selection/normalization of available RMS statistics or new features, context window,
inference cadence and timestamps (audio blocks are already 4 ms nominal);
continuous DSP parameter units/ranges and supported controls; baseline calibration mapping;
event ownership and synchronization of physical/app corrections; CPU/RAM/latency budget;
model persistence and schema versioning; app-to-device preference protocol (the
existing PCM serial protocol is not a calibration/correction transport).

Future event envelope (PROPOSED, outside learner API): context sequence/time, schema
version, applied/predicted parameters, explicit preferred target and feedback mask, correction source
and baseline version. Caller must align corrections to the context the user heard.

Future STM32 path (PROPOSED): calibration → baseline; extracted features → inference →
DSP semantic mapping → actual processing; explicit correction → model update. The
learner must eventually operate without the app. DSP owner handles coefficient
smoothing, supported transformations, output protection and headphone safety. Caller
handles stale contexts, scheduling and telemetry. No speculative adapters are included.
