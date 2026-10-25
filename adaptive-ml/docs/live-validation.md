# Pinned-image end-to-end validation

Hardware owner is building/flashing **ba961a4**. New docs/tools on this branch do not
change its firmware. Record the actual source SHA, AUDIO_ADAPTIVE_ML=ON, build flags,
ELF hash, clock, microphone wiring and player version with results. Newer main's v3
release is not proof of an ML-enabled image. No physical results have been obtained
by this documentation/tooling task. Existing host results are synthetic only.

Do not rebuild/reflash the teammate's active image, stop their player, open its COM
port, or operate app dials concurrently. Run the commands below on the validation PC
only after the hardware owner confirms readiness. Existing build/flash instructions
remain in [embedded-integration.md](embedded-integration.md).

## Observation boundary

| Source | Actually observable | Not established by it |
| --- | --- | --- |
| `build/hardware-status.json`, written by player | timestampMs, streaming/error, protocol, referenceClock, primary/reference/outputRms, filter, values.noiseReduction, commandSequence/status, maxCycles, packet/error counters | ML build, enabled mode, normalized context, individual prediction, model examples/corrections, instantaneous smoothed strength |
| GET `http://127.0.0.1:8765/api/status` if existing API runs | Above, plus connected/capabilities derived by Node server | New ML feedback routes; raw capabilities list is not ML discovery |
| Non-halting debugger, `g_adaptive_stats` | windows, predictions, corrections, examples, enabled, context[3], inference_max_cycles, update_max_cycles | Per-event context history; prediction counter counts actions, not their values |
| Debugger, `g_control_stats.value[1]`, `g_audio_stats`, `g_noise_stats` | Applied target, detailed capture/error/clip/reset counters | Calibrated headphone SPL, intelligibility or hearing benefit |

Exact stored training context is the static `policy.model.examples[0].context` in
`audio_passthrough/Core/Src/adaptive_audio.c` after the first accepted correction.
Use its stored context for distance comparisons, not an approximate later RMS sample.
Static-symbol/type inspection requires a matching symbol-bearing ELF/debugger setup;
if unavailable, mark that evidence missing rather than altering the active image.

The output RMS depends on input and DSP and cannot alone demonstrate learned recall.
Features use mean 25-block pre-processing RMS, not the single RMS fields in one status
packet. Do not reconstruct an exact model context from those occasional packets.
Do not halt on breakpoints while measuring continuous audio: that can cause faults.

## Procedure and pass/fail criteria

Use the already-running player at the agreed low playback gain. Choose a stable scene
A with both microphones nonzero, referenceClock=true, spatialFocus=0 and no fault.
Allow the existing NLMS training interval to complete. The browser is optional.
If it restored settings, finish that first and leave it idle: strength restoration
pauses autonomy. The debug helper must not race the Node API's command queue.

1. **Initialize:** below commands clear preference memory (not NLMS) and enable
   autonomy. Hold A steady at least 1 s. Expect applied strength 50 and examples=0.
   Record timestamp, baseline applied target, context A and prediction counter via
   debugger. The standalone prediction value is not in external telemetry.

   ```powershell
   .\scripts\adaptive-feedback.ps1 -Action clear
   .\scripts\adaptive-feedback.ps1 -Action enable
   Get-Content build/hardware-status.json -Raw | ConvertFrom-Json | ConvertTo-Json -Depth 4
   ```

2. **Explicit correction:** keep A stationary and run:

   ```powershell
   .\scripts\adaptive-feedback.ps1 -Action correct -Strength 75
   ```

   Pass: helper sees matching sequence/status=0; applied target becomes 75; debugger
   corrections increases by exactly one and examples=1. Record the training context
   after acceptance. Status success without debugger evidence supports acceptance,
   not independent confirmation of model state. Failure/rejection is not a pass.

3. **Hold:** wait at least 3 s in A, including the two-second correction hold.
   Pass: target stays near 75 without another setter/correction. Do not use enable
   during this step; it clears the hold in ba961a4.
4. **Unfamiliar B:** keep reference usable and change measured input levels, not just
   a semantic room label. Let it stabilize >=1 s. For the single saved example,
   verify `sqrt(sum((contextB-contextA)^2)/3) >= 0.15` via debugger. Third feature is
   constant 0.5. A 20 dB digital-level shift in both features would exceed the radius
   if neither clips/floors, but verify actual contexts rather than assuming it.
   Pass: applied strength=50, with corrections still exactly one. Silence/missing
   reference inhibits inference and is NOT an unfamiliar-context fallback test.
5. **Return A:** restore its levels and wait >=1 s. Pass: target moves toward 75
   without ID 14 or a normal setter; for this demo use 70..75 as a predeclared near-A
   tolerance and record actual context distance/strength. Exact same context should
   return 75. Counter evidence plus controlled inputs is needed to call this recall.
6. **Repeat:** perform ten A/B round trips, dwell >=1 s per scene, and record each
   measured target/context. No extra correction, ordinary strength write, reset or
   reconnect during the test. Fail if stationary-scene strength repeatedly oscillates,
   correction count changes, or B is falsely accepted as a demonstrated fallback.
7. **Stability gate:** compare transport counters after warmup: no increments in
   missing/crc/firmwareDrops/underruns/overflow, no new faults/deadline/sync errors or
   numeric resets/clips. Require maxCycles <384000 at nominal 96 MHz (4 ms), with
   margin reported, plus foreground DWT maxima. This is a finite test, not sustained
   reliability certification. Stop and preserve logs on a fault; do not hide a reset.

For manual pause/resume checks (not additional training):

```powershell
.\scripts\adaptive-feedback.ps1 -Action disable
.\scripts\adaptive-feedback.ps1 -Action enable
```

Capture results outside tracked source, e.g. `build/ml-validation/`: image SHA,
initial counters, each scene/time/applied value/context, correction ack sequence/status,
final counters and DWT maxima. Separate EXPECTED values from OBSERVED values. Until
debugger evidence is recorded, mark model state and recall as unverified.

## Read-only status helper

Node.js 24 is sufficient; no dependencies, serial port, network request or command
write. Run from a separate tooling checkout on the validation PC, pointing explicitly
at the pinned ba961a4 checkout's status file. Alternatively copy only the helper file
to a separate directory and pass `--file`; do not update/rebuild the pinned firmware.
From this repository root, the default file is `build/hardware-status.json`:

```powershell
node adaptive-ml/tools/status-summary.mjs
node adaptive-ml/tools/status-summary.mjs --file C:\path\to\pinned-checkout\build\hardware-status.json --json
# Approximately one minute of read-only sampling; stdout can be captured by the shell.
node adaptive-ml/tools/status-summary.mjs --samples 240 --interval 250 --json
node --test --test-isolation=none adaptive-ml/tests/status-summary.test.mjs
```

`--interval` is milliseconds; `--json` emits one JSON object per sample. Text output
shows freshness, applied target, ack and maximum callback cycles. JSON additionally
includes observed counters/deltas, counter resets and warning lists. Omitted/malformed
numeric fields remain null, not invented zeros. Stale/malformed/missing status never
falls back to a cached live reading. Exit 1 means at least one unavailable/invalid,
stale, faulted, stopped or non-MIC4 snapshot; exit 2 is a usage/runtime error. Warnings
and counter changes must also be reviewed: exit 0 is NOT a validation pass.

The helper labels hidden ML state explicitly and does not infer predictions, learned
examples, autonomy or capability from applied strength/MIC4. "live" only describes
the status snapshot, not microphone validity or model readiness. Its age window is
-1000 <= age <1500 ms, matching the existing API; callback budget assumes nominal
96 MHz. It does not distinguish ordinary versus automatic strength changes.
Tests use synthetic fixtures; no new hardware measurements were made. Logs can be
saved under ignored `build/ml-validation/` without changing the player/status files.

## Five critical integration risks

| Failure mode | Detection | Smallest reasonable response/fix, requiring owner coordination where relevant |
| --- | --- | --- |
| Missing/stale input features | stale/error status, referenceClock=false or RMS=0; debugger windows/context stop, correction rejected | Restore capture/clock/reference first. Existing firmware gates invalid contexts; do not fabricate a feature. Confirm snapshot freshness before proposing changes. |
| Parameter oscillation | repeated applied-target changes while a measured context is stationary; context-distance trace | Verify inputs and absence of concurrent writers. Tune dwell/hysteresis only after evidence; do not change firmware during the pinned-image trial. |
| Manual value overwritten | target changes after ordinary ID 1 despite autonomy expected paused; debugger enabled state | Serialize final setter, correction and resume; remove accidental trailing setters/telemetry-to-setter UI loops. Check existing manual override before firmware changes. |
| Lost/misclassified feedback | no matching ack, status=1, correction count differs from one, changes after hydration | Add explicit confirmation through the existing API queue; preserve retry sequence; never infer training from dial updates. Keep debug helper/API writers mutually idle. |
| Timing/communication failure | maxCycles near 4 ms, rising packet/drop/CRC/underrun counters, latched I2S fault | Preserve logs/image, compare ML OFF/ON on the same setup. Resolve capture/transport first; measure IRQ masking and foreground cost before scheduling changes. |

Next action after the hardware owner returns build/live results: verify the pinned
SHA and run this one recorded A -> correction -> B -> A acceptance sequence together,
then decide whether draft PR #2 can progress. Do not change its draft/merge status here.
