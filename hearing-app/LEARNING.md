# Learning through app adjustments

Connect USB in the browser on the Windows audio-bridge computer. In Manual,
adjust Background Noise Reduction and release it. The app shows **Learning your
preference…**, followed by **Preference learned** only after acknowledgment.
There is no separate Save/Remember action. Values are arbitrary integers 0–100.

The status card sits directly below the Noise Reduction dial. It shows Adjusting,
Learning preference… and, only after successful ID14 acknowledgment, ✓ Preference
learned for four seconds before returning to the automatic-mode message. Telemetry
does not reset this confirmation period. A target-refresh failure appears as a
separate warning without undoing the accepted correction; the displayed Device
target still comes from telemetry, never from the selected value. A new adjustment,
reset, disconnect or correction failure takes priority over the old confirmation.

The old indicator was below all five dials and success waited for a second HTTP
status read. Those were code-level visibility/delay risks, not a confirmed diagnosis
of any particular hardware run. Seeing this card requires the updated browser bundle.

For a new judge, open Settings → Reset Learning → Confirm Reset Learning. Keep
Spatial Focus at zero and provide a usable reference microphone signal. After
reset, the firmware returns to its 50% baseline when valid acoustic features are
processed; the app does not force a strength setter to fake this result.

## Interaction and command behavior

- Pointer/touch: ordinary ID 1 setters can follow changes during a drag. The real
  gesture finalization event commits its final value once, only on successful
  release. A stationary or long-held drag has no save timer. Cancellation does
  not train.
- Keyboard: changes are grouped until 400 ms after the last key release; holding
  an adjustment key never starts that timer. Accessibility increment/decrement
  actions group changes until 400 ms after the last action.
- Each completed adjustment waits for the final ID 1 acknowledgment, then calls
  the existing `confirmNoiseReduction(finalValue)` once. That method validates
  the final acknowledged value and POSTs `/api/noise-feedback` → ID 14. It does
  not send an extra setter. Firmware correction handling enables autonomy and
  holds the explicit target for two seconds before normal inference resumes.
- Later interactions remain editable while an earlier correction is pending.
  Their commands wait behind it. Older acknowledgments/errors cannot replace
  the newer pending selection or its status. Intermediate queued values coalesce.
- A failed setter prevents its correction. Rejected/failed corrections display
  an error and are not retried automatically. Even an ambiguous HTTP timeout
  consumes that user decision; a fresh deliberate adjustment is required to
  submit another. Bridge retransmissions keep the original command sequence.

The UI shows the pending selection separately from the device-reported target.
Polling updates the target and, when no selection is pending, the dial. It never
calls setters or correction methods. Hydration and profile restoration only
restore local state; connection/reconnection never replays cached controls.
Navigation's `activeMode` is a screen preference and sends no firmware command.

**Automatic adaptation enabled** reflects the last acknowledged app action.
Reconnect shows mode unconfirmed: MIC4 does not report authoritative current ML
mode, ML capability, model counts, context, confidence, or persistence. The UI
does not invent these values. Spatial Focus and invalid acoustic input can
prevent inference even after autonomy has been enabled.

Reset invalidates unfinished/queued adjustments and waits for any command
already in flight. The existing server queue executes ID 16, checks its matching
successful acknowledgment, executes ID 15/value 1, checks its acknowledgment,
then the app refreshes status. Dials are disabled during reset. Either failure
shows an error; no success, restart, ID 1, or ID 14 follows reset automatically.
All traffic uses the existing HTTP server, command file, and sole C# serial owner.

## Demo

1. Use an approved firmware image built with `AUDIO_ADAPTIVE_ML=ON`, valid dual-mic
   input and Spatial Focus 0. The feature defaults OFF in the firmware build;
   MIC4 protocol alone does not prove it is enabled.
2. Connect and Reset Learning. Wait for the success message and valid features
   to return the reported target to roughly 50%.
3. Establish stable acoustic conditions A. Adjust to your preference (e.g. 80%)
   and release. Wait for Preference learned.
4. Establish sufficiently different conditions B. Let the previous two-second
   correction hold expire and the new context stabilize. Adjust (e.g. 30%),
   release, and wait for Preference learned.
5. Return to A and B without touching controls. Observe the device target and
   dial follow firmware predictions. The app sends no recall commands and has
   no environment labels, scene detection, presets, or playback switching.
6. Reset Learning for the next judge.

The learner needs a fresh, stable acoustic context for a correction; unstable or
invalid input can reject ID 14. Keep the scene steady while adjusting and saving.
Its present RMS features distinguish measured levels, not semantic scene names;
similar features may produce blended/replaced preferences. Learned examples live
in RAM. No physical-demo or persistence claim follows from the host tests below.

For a jumping-target investigation, keep one scene steady for at least ten seconds
after the two-second correction hold expires. Record Device target, status timestamps,
commandSequence/status and the Network control/feedback requests. A changing target
with no new command sequence is consistent with autonomous inference; it is not proof
of training. ID14 is the only correction handler; inference never calls it. Model
correction/example counters, enabled state and normalized context remain debugger-only.
Compare context drift to the existing three-window stability threshold (.03 per
feature), 250 ms freshness and radius .15 before considering firmware changes. DSP
wet strength already slews .002 per sample; this does not smooth the reported integer
target. Get hardware-owner evidence before altering any of these settings.

## Verification (2026-10-25)

Passed on the host with Node 24.19 (the store test uses `node:module.registerHooks`):

- `cd hearing-app && npm test`: 41 tests, including completed input events,
  setter/feedback acknowledgment ordering, rapid overlapping edits, failures,
  hydration/profile/reconnect/telemetry isolation, and reset cancellation.
- App `npm run typecheck` and `npm run lint`.
- `node --experimental-strip-types --test tests/*.test.mjs`: 2 tests against
  the actual service, HTTP server, serialized queue and emulated command/status
  files. Reset rejects/timeouts/order are covered. A/B protocol emulation learns
  83 and 27 and observes repeated recall without any new commands. Its map is a
  test fixture, not the firmware model or real acoustic recognition.
- `node --experimental-strip-types --test adaptive-ml/tests/*.test.mjs`: 7 tests.
- `make -C adaptive-ml test evaluate test-dsp`: existing model/runtime/DSP tests,
  including synthetic 80/30 recall through the real DSP code.
- Existing native audio sample, audio controls, noise filter, and spatial focus
  C tests compiled and passed.
- Isolated browser with a transport emulator: held pointer drag caused no
  correction; release caused one. Rapid keyboard changes caused one final
  correction. Autonomous target updates emitted no setters. Reset cleared the
  learned indicator and restored target 50 without an ordinary setter.

Not verified: live STM32 correction/recall, C# serial/audio execution, or an ARM
build/flash. The Windows bridge and approved ML-enabled hardware image remain
required for the full physical demo. No firmware algorithm or driver was changed
by this app task.
