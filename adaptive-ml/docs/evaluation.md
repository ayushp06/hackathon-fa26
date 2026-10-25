# Synthetic evaluation

Run `make test evaluate` from `adaptive-ml/`. C11, standard math and Make only;
no downloads. Keep assertions enabled (no `NDEBUG`). `tests/test_preference.c`
checks baseline, correction, replacement, invalid input/state preservation, reset and
baseline changes. `tests/test_scenarios.c` checks nearby interpolation, exact unfamiliar
fallback, 1,000 repeated transition cycles without updates, 1,001 bound-check queries,
FIFO overflow and reset. `simulation/evaluate.c` checks deterministic replica agreement
and improvement over constant baseline on its synthetic nearby test set.
`tests/test_partial.c` additionally checks single-output isolation, merged masks,
preserved prior preferences, independent per-output weights/attenuation, exact versus
nearby evidence, rejected empty/invalid events without mutation, full-vector equivalence,
determinism, bounds, FIFO mask clearing and reset.

## Reproducible methodology

No PRNG: four corrections at (0.2/0.8, 0.2/0.8, 0.2). Arbitrary continuous targets:
`y0 = 0.2 + 0.6*x0`, `y1 = 0.75 - 0.5*x1`. Baseline=(0.5,0.5), limits=[0,1],
radius=0.2. Third feature intentionally has no target relevance.

Nearby held-out queries offset each center by `(d,-d,d)`, with d in
{-0.03,-0.02,-0.01,0.01,0.02,0.03}: 24 unique contexts repeated across ten cycles.
Repeats verify transitions; they do not increase independent evaluation sample size.
Twenty unfamiliar queries use `(0.3+0.02*i,0.5,0.95)`, i=0..19, outside all radii.
No evaluation target is fed into training. Model remains at four examples throughout.

MAE = mean absolute error across query/output pairs; RMSE = square root of mean
squared error across those pairs. Units are normalized abstract output units.

## Measured results

GCC 13.2.0 on Windows and GCC 15.2.0 on Ubuntu; rounded to six decimal places:

| Set | Predictor | MAE | RMSE | Query/output pairs |
| --- | --- | ---: | ---: | ---: |
| Nearby | Contextual learner | 0.016500 | 0.021508 | 480 |
| Nearby | Constant baseline | 0.165000 | 0.166109 | 480 |
| Unfamiliar | Contextual learner | 0.030000 | 0.049112 | 40 |
| Unfamiliar | Constant baseline | 0.030000 | 0.049112 | 40 |

The 90% nearby MAE reduction applies only to this constructed dataset. Unfamiliar
outputs exactly equal baseline, so no improvement is expected there. Host model
storage after adding partial-feedback masks is 432 bytes on these 64-bit builds
(previously 368); metrics above remain unchanged for full-vector training. Target ABI size and execution time must be
measured on STM32. No embedded compilation or hardware timing has been verified.

## Limitations

These are synthetic normalized contexts and preferences, not microphone recordings,
calibrated audio or a user study. Radius/normalization need real validation. The linear,
stationary, noiseless target and sparse separated centers favor this locality method;
no missing features, user-delay ambiguity or contradictory preferences are evaluated
quantitatively. Compare online regression and other models using session-separated real
data before selection. Tests establish software behavior only, not speech intelligibility,
hearing benefit or clinical effectiveness. Real evaluation needs contextual corrections
and a working measured audio path. DSP smoothing/safety are external responsibilities.
