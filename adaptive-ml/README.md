# Adaptive preference learning

Independent experimental C11 workstream for learning personal processing preferences
from explicit corrections in acoustic contexts. No app, firmware, feature extractor
or DSP algorithm is implemented here. No dependencies or dynamic allocation are planned.

## Structure and milestones

- `docs/interface-proposal.md`: provisional boundaries and integration blockers.
- `docs/decisions.md`: design choices and open questions.
- `docs/evaluation.md`: synthetic evaluation plan and limitations.
- `include/preference.h`: public API and inspectable fixed storage.
- `src/preference.c`: learner; `tests/test_preference.c`: focused unit tests.
- `simulation/evaluate.c`: deterministic evaluation against a constant baseline.

## Build and tests

Requires an existing C11 compiler, standard math library and Make; no installation
or app dependencies. From this directory on Linux/macOS or Ubuntu WSL:

```sh
make test
make evaluate
```

Equivalent direct command (also usable with MinGW GCC on Windows):

```sh
mkdir -p build
cc -std=c11 -O2 -Wall -Wextra -Wpedantic -Werror -Iinclude src/preference.c tests/test_preference.c -lm -o build/test_preference
./build/test_preference
```

Compile `tests/test_scenarios.c` and `simulation/evaluate.c` in place of
`tests/test_preference.c` for the additional executables. On PowerShell create
`build` with `New-Item -ItemType Directory -Force build`, invoke your GCC path
in place of `cc`, and use `.exe` output names. Do not define `NDEBUG`: test and
simulation assertions are required. Generated executables live in ignored `build/`.

Tests cover baseline, exact corrections, superseding corrections, immutable inference,
invalid inputs, reset and baseline replacement. All API calls except reset return
success/failure; callers must check results and use only successfully initialized models.

## Algorithm

Default shape: 3 abstract features, 2 abstract outputs, 16 examples. These compile-time
choices are experimental, not hardware requirements. Outputs/baseline/targets are finite
normalized absolute values within configurable limits. Invalid targets are rejected.
Each example inside the configured RMS-distance radius gets weight `(1-distance/radius)^2`.
Prediction blends the weighted target with baseline using the greatest similarity.
Outside all radii it returns baseline; an exact context returns its latest correction.
The returned signed adjustment is `value-baseline`; apply either representation, not both.

New contexts replace the oldest inserted slot when full. An identical context updates
its existing slot without refreshing FIFO age. Inference never learns from inactivity.
Reset preserves configuration/baseline; changing baseline clears learned examples.
There is no DSP, smoothing, safety limiter, persistence or concurrent access support.
Features require comparable normalization; conflicting nearby corrections can average.

## Integration usage

1. Allocate `pl_model` in caller-owned static storage; call `pl_init` with limits,
   radius and personal baseline. Check success before using the model.
2. Call `pl_predict` on valid normalized features. Inspect `pl_prediction.value`,
   `.adjustment` and `.familiarity`; inference has no side effects.
3. Only an explicit user target calls `pl_correct` with the associated context.
4. Inspect `.count`, `.next`, `.examples`, `.baseline` and `.config` read-only.
   `pl_reset` clears examples; `pl_set_baseline` validates and starts a new memory.

Do not transfer raw model structs as a persistence/protocol format. Do not modify
public fields, pass overlapping argument storage, or call concurrently. DSP mapping,
feature schemas, event alignment, scheduling and output protection require agreement
with teammates before any adapter is implemented. No STM32 timing claim is made.
See `docs/evaluation.md` for synthetic results and reproducible checks.

The app and STM32/DSP remain separate teammate workstreams. The repository has no
root README; adding one is a possible future shared housekeeping task, outside this scope.
