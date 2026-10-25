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
