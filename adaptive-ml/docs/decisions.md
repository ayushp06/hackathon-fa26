# Decisions

1. PROPOSED baseline: bounded contextual memory with distance-weighted continuous
   targets, attenuated toward personal baseline outside known contexts. Interpretable,
   allocation-free and cheap to inspect; not a final algorithm selection. Alternatives:
   online linear regression, kernel regression and tiny neural models after data exists.
2. PROPOSED abstraction: normalized unnamed feature/output dimensions. Avoid coupling
   to app labels or claiming nonexistent DSP. Semantic mapping requires team agreement.
3. PROPOSED capacity policy: FIFO examples, explicit corrections only. Simple bounded
   storage; old or rare preferences may be forgotten. No implicit reward from inactivity.
4. BLOCKED: actual feature quality, memory/timing budget, supported DSP parameters,
   persistence and preference drift policy. Evaluate before selecting a final model.

5. IMPLEMENTED prototype: 3 features, 2 outputs, capacity 16, configurable compact
   distance radius. Compact weights exclude examples outside the radius; multiple
   nearby examples still affect the average. Maximum similarity attenuates the target
   toward baseline; it is familiarity,
   not calibrated statistical confidence. Exact duplicate contexts use latest target
   without consuming capacity or refreshing FIFO age. Baseline changes clear memory.
   Limits reject invalid targets/baselines; predictions additionally clamp rounding.
   Linear scan is O(capacity × (features + outputs)); no heap or recursive calls.

6. Evaluation uses a deliberately simple synthetic linear target function and four
   explicit corrections. It tests locality/fallback, not algorithm superiority.
   No hyperparameter search or real audio data. Exact-match precedence can introduce
   a discontinuity near contradictory examples; DSP smoothing remains external.
   FIFO does not solve preference drift, and duplicate detection is exact float equality.

7. IMPLEMENTED partial feedback: retain `pl_correct` as explicit full-vector supervision
   and add `pl_correct_masked` with one unsigned-char selector per output. Byte arrays
   avoid a bit-width limit and bit manipulation. Only selected targets are validated
   and stored; empty masks fail transactionally. Identical contexts merge masks and
   overwrite only selected targets, preserving prior supervision for other outputs.
   Weight normalization, familiarity attenuation, exact-match precedence and baseline
   fallback are per output. Public scalar familiarity remains maximum across outputs
   for compatibility; it must not be interpreted as all-output confidence. FIFO still
   evicts whole contexts and can forget any dimension's old preferences. Host model
   grows 368→432 bytes (example 20→24 with alignment); no heap or persistence format.

8. Integration review against main `803033a`: keep this PR standalone. Firmware
   now performs dual-mic NLMS and exports digital RMS; app communication is still
   mocked. Neither provides a continuous preference-control contract. Retain abstract
   dimensions and the existing algorithm; defer firmware linking, normalization,
   correction transport and target timing to a separate coordinated integration task.

9. Embedded slice from main `b29a601`: reuse its existing continuous smoothed NLMS
   strength rather than adding another wet/dry implementation. Map two real input
   RMS statistics plus one documented neutral input; pin unsupported output 1 to
   baseline. Mean 25 block measurements, require three stable windows, infer in
   foreground and publish through Controls at block boundaries. Explicit reserved
   debug commands train output 0; ordinary setters pause autonomy without training.
   Session-only memory and opt-in build avoid flash wear and preserve default builds.
   Synthetic real-DSP tests validate mechanics; no target/hardware claims follow.

10. Task13: merge main `5f4b4f4` without production policy changes. Real-DSP two-context host test recalls80/30 from one correction each over ten round trips; identical RMS cannot distinguish contradictory preferences. Preserve radius, baseline and hold. Current app explicit confirmation and queued14/15/16 are implemented; remaining gaps and hardware-only checks are in two-context-demo.md. Hardware remains pinned ba961a4.

11. Task14: preserve app main `7f13e6e` exactly. Confirmation waits for the already
    requested final setter acknowledgment and emits one ID14 without a redundant
    ID1. Extend real HTTP/queue tests for pending ack, concurrent/duplicate rejection,
    offline/reconnect non-training and failed setters. Update runbooks for local-only
    hydration/profile restore and Settings Reset Learning. No production policy or
    firmware change; default ML OFF, target build and physical validation pending.
