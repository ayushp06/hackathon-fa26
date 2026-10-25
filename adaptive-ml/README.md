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

Compile `tests/test_scenarios.c`, `tests/test_partial.c` and `simulation/evaluate.c` in place of
`tests/test_preference.c` for the additional executables. On PowerShell create
`build` with `New-Item -ItemType Directory -Force build`, invoke your GCC path
in place of `cc`, and use `.exe` output names. Do not define `NDEBUG`: test and
simulation assertions are required. Generated executables live in ignored `build/`.

Tests cover baseline, exact corrections, superseding corrections, immutable inference,
invalid inputs, reset, baseline replacement and partial-feedback isolation. All API calls except reset return
success/failure; callers must check results and use only successfully initialized models.

## Algorithm

Default shape: 3 abstract features, 2 abstract outputs, 16 examples. These compile-time
choices are experimental, not hardware requirements. Outputs/baseline/targets are finite
normalized absolute values within configurable limits. Invalid selected targets are rejected.
Each example inside the configured RMS-distance radius gets weight `(1-distance/radius)^2`.
For each output independently, prediction uses only examples explicitly correcting
that output and blends their weighted target with baseline using their greatest similarity.
Without relevant examples in radius, that output returns baseline; an exact context
returns its latest correction for that output. The scalar `familiarity` is the maximum
across outputs, not evidence that every output was supervised.
The returned signed adjustment is `value-baseline`; apply either representation, not both.

New contexts replace the oldest inserted slot when full. An identical context updates
only its selected outputs in the existing slot without refreshing FIFO age; earlier
corrections for untouched outputs remain. Eviction removes all outputs in the old slot.
Inference never learns from inactivity.
Reset preserves configuration/baseline; changing baseline clears learned examples.
There is no DSP, smoothing, safety limiter, persistence or concurrent access support.
Features require comparable normalization; conflicting nearby corrections can average.

## Integration usage

1. Allocate `pl_model` in caller-owned static storage; call `pl_init` with limits,
   radius and personal baseline. Check success before using the model.
2. Call `pl_predict` on valid normalized features. Inspect `pl_prediction.value`,
   `.adjustment` and `.familiarity`; inference has no side effects.
3. Call `pl_correct_masked(model, context, target, mask)` only for explicit user
   corrections. `mask` is a `PL_OUTPUTS`-length unsigned-char array: nonzero selects an
   output. Only selected targets are read/validated; untouched values may be NaN.
   A null/empty mask returns 0 without training or eviction. `pl_correct` is preserved
   as an all-selected wrapper: use it only when every output is explicitly confirmed.
4. Inspect `.count`, `.next`, `.examples`, `.baseline` and `.config` read-only.
   `pl_reset` clears examples; `pl_set_baseline` validates and starts a new memory.

Do not transfer raw model structs as a persistence/protocol format. Do not modify
public fields, pass overlapping argument storage, or call concurrently. DSP mapping,
feature schemas, event alignment, scheduling and output protection require agreement
with teammates before any adapter is implemented. No STM32 timing claim is made.
See `docs/evaluation.md` for synthetic results and reproducible checks.

Mask storage adds two bytes per example plus alignment at the current dimensions:
host `sizeof(pl_example)` grows 20→24 bytes and `sizeof(pl_model)` 368→432 bytes.
Prediction remains 20 bytes; inference uses small per-output stack arrays, no heap.
Target ABI size/stack and timing still require STM32 measurement.

The app and STM32/DSP remain separate teammate workstreams. The repository has no
root README; adding one is a possible future shared housekeeping task, outside this scope.
