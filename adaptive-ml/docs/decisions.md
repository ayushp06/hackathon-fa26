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
