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
