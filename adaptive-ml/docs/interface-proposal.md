# Interface proposal — not an agreed team contract

## Status

CONFIRMED (repository at f7ab6ee): app transport is mocked; its public controls now
include volume, noise reduction, spatial focus, speech amplification, bass/mid/treble.
See `../../hearing-app/src/device/types.ts`. These names do not establish working DSP.
`../../hearing-app/src/state/manualValues.ts` defines signed app EQ ranges; these are
not adopted by this module. No firmware is tracked. Hardware documentation describes
one microphone (`../../docs/hardware_architecture.md`). No shared files will be edited.

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

Feature extraction availability, definitions, frame duration, cadence and timestamps;
DSP parameter units/ranges and supported algorithms; baseline calibration mapping;
event ownership and synchronization of physical/app corrections; CPU/RAM/latency budget;
model persistence and schema versioning; real communication protocol.

Future event envelope (PROPOSED, outside learner API): context sequence/time, schema
version, applied/predicted parameters, explicit preferred target and feedback mask, correction source
and baseline version. Caller must align corrections to the context the user heard.

Future STM32 path (PROPOSED): calibration → baseline; extracted features → inference →
DSP semantic mapping → actual processing; explicit correction → model update. The
learner must eventually operate without the app. DSP owner handles coefficient
smoothing, supported transformations, output protection and headphone safety. Caller
handles stale contexts, scheduling and telemetry. No speculative adapters are included.
