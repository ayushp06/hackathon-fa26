# Adaptive preference learning

Independent experimental C11 workstream for learning personal processing preferences
from explicit corrections in acoustic contexts. No app, firmware, feature extractor
or DSP algorithm is implemented here. No dependencies or dynamic allocation are planned.

## Structure and milestones

- `docs/interface-proposal.md`: provisional boundaries and integration blockers.
- `docs/decisions.md`: design choices and open questions.
- `docs/evaluation.md`: synthetic evaluation plan and limitations.
- Planned next milestone: `include/` public API, `src/` learner, `tests/` unit tests.
- Final milestone: `simulation/` deterministic evaluation against a constant baseline.

Build commands and measured results will be added with the working implementation.
The initial documentation milestone contains no learning algorithm.

The app and STM32/DSP remain separate teammate workstreams. The repository has no
root README; adding one is a possible future shared housekeeping task, outside this scope.
