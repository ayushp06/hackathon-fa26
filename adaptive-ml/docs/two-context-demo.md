# Two one-shot preferences: validation and live runbook

Main `7f13e6e` merged normally into the integration branch. No production model,
DSP, driver, app or bridge edits were made for this test. Hardware validation stays
pinned to `ba961a4`; newer branch commits are not a newly approved flash candidate.
This is a host-tested experimental feature, default AUDIO_ADAPTIVE_ML=OFF.
ARM compilation and physical autonomous correction/recall remain pending.
Host success is not physical STM32 validation or hearing benefit.

## Evidence and policy

From `adaptive-ml/`: `make test evaluate test-dsp`.
`tests/test_two_environments.c` executes real NLMS/CMSIS kernels, Controls,
Adaptive_ObserveBlock/Poll/Command, runtime and preference.c. Deterministic xorshift
correlated microphone signals use amplitudes .15/.0015, not environment labels fed
to the model. Real pre-processing integer RMS drives the 25-block feature mailbox.
Clear + enable, baseline 50, exactly one correction 80, B baseline 50, exactly one
correction 30, then ten complete A/B round trips with no commands. The first 1.6 s
after each correction retains the explicit target. Each recall settles 2.4 s and
checks 200 blocks: A applied 80..80 (error 0), B 30..30 (error 0), two corrections,
two examples, autonomy enabled, sequence unchanged, no clips or NLMS resets, bounded
PCM and strength, stable tail range <=2 points. Synthetic separation was .329683;
A tail features roughly [.742,.790,.5], B [.338,.383-.386,.5]. The actual DSP control
is exercised, not just a model return. Existing test_dsp_loop separately checks an
actual output-energy change. PCM packing regression is tests/audio_sample_test.c;
these tests do not execute I2S DMA or MIC4 serial framing/CRC on a board.

Predictor: d=sqrt(sum((query-example)^2)/3), radius .15. Exact matches recall the
target directly. Otherwise weights=(1-d/.15)^2, weighted targets blend toward
baseline 50 by maximum similarity 1-d/.15, per output. With only one relevant
example, error in percentage points is |target-50|*d/.15. Thus preselected +/-10
points permits d<=.05 for A and d<=.075 for B, provided the other example is outside
radius. Disjoint neighborhoods (training separation >.30) are preferable. No tuning
was needed. Familiarity is proximity, not calibrated confidence; no minimum sample
count is needed. B does not evict A: memory is FIFO16 contexts, RAM only, lost on reset.

Ambiguity test: identical primary/reference RMS 100/200 with 80 then 30 replaces the
same example; recall is 30, error -50 against the earlier target. Nearby overlapping
neighborhoods blend targets except exact-match precedence, so nearly contradictory
examples can produce abrupt model targets. Existing DSP wet smoothing remains.
The model does not recognize songs, speech, or semantic environments. Both measured
levels must actually differ; normalization is log RMS over -100..0 dBFS, with a
constant third input. Saturation/floor/quantization can erase distinctions.

## Live procedure (requires approved ML-enabled firmware)

1. Use low PC playback gain, stable dual-mic capture, spatial focus 0. Finish browser
   connection, hydration and profile restoration first. Do not restart/reconnect
   during the run. Verify fresh MIC4 status, streaming true, error null, reference
   clock true, nonzero input RMS, no increasing loss/CRC/drop/clip counters, callback
   maxCycles <384000 at 96 MHz. MIC4 alone does not imply ML support.
2. Select reproducible speaker levels, not song names. Observe actual debugger
   `g_adaptive_stats.context`; compare to the stored vectors in
   `policy.model.examples[].context` using a matching ELF without halting audio.
   Require separation >.30 preferably, and stable within-scene drift below .05 for A
   and .075 for B. Status RMS is individual-block data, not the training window.
   Avoid clipping and too-quiet reference; the synthetic 40 dB difference is evidence
   for the host test, not a safe mandatory room playback level.
3. In Settings, choose **Reset Learning**, then **Confirm Reset Learning** (queued
   clear then enable). Return to Manual. Hold A steady >=300 ms (prefer >=1 s after a scene change); confirm
   applied baseline near50. Select noise reduction80, release dial and keep it idle,
   then press **Remember this adjustment** ONCE. Confirmation waits for the pending
   ordinary setter acknowledgment; it sends only ID14, not an extra setter. Wait for accepted message and
   matching status=0 acknowledgment. Debug counters: corrections1/examples1/enabled1.
   The two-second hold is global even if you immediately move to B.
4. Establish B, wait >=2.4 s and verify baseline near50 before teaching. Select30,
   release and press **Remember this adjustment** ONCE. Verify corrections2/examples2,
   enabled1, and capture its commandSequence. Wait >=2.4 s.
5. Return A, wait >=2.4 s; device target should approach80 within +/-10. Return B,
   wait >=2.4 s; target should approach30. Repeat ten round trips without touching
   dials, Remember, Resume, profiles, reconnect, or replay commands. Telemetry can
   refresh both the displayed dial and device target without sending a setter. Record timestamps, context,
   target, counters and commandSequence. The sequence must stay unchanged while
   target follows context; debugger must show enabled1/corrections2/examples2.
   Audio target change alone is not proof of autonomous inference.

Backup from repository root, with app actions/queue idle (never concurrent writers):

```powershell
./scripts/adaptive-feedback.ps1 -Action clear
./scripts/adaptive-feedback.ps1 -Action enable
# A stable: ONE correction
./scripts/adaptive-feedback.ps1 -Action correct -Strength 80
# B stable, previous hold expired: ONE correction
./scripts/adaptive-feedback.ps1 -Action correct -Strength 30
# Recall: observation only, send NO commands
node adaptive-ml/tools/status-summary.mjs --samples 100 --interval 250
```

Observe build/hardware-status.json timestampMs, streaming/error, values.noiseReduction,
commandSequence/commandStatus, referenceClock, primaryRms/referenceRms, maxCycles,
packets/missing/crc/firmwareDrops/underruns/overflow. Model mode/context/counts and
foreground DWT maxima require debugger; do not fabricate them from JSON. A later
ID1/manual dial pauses autonomy. Current hydration, profile restoration and reconnect
do not send ID1 or train. Check
enabled and command-file/API activity; the UI's old success text does not prove mode.

If feature capture is invalid, stop the claim: no new inference/correction should
occur; the existing applied target may remain. Fix clock/reference/spatial/fault
conditions with the hardware owner, reestablish stability, and clear/reteach only
if restarting the demonstration. For ambiguous contexts change reproducible levels
or geometry and measure separation before retrying, not learning coefficients.
Pause via app or `-Action disable`, lower ordinary strength/volume if needed; clear
then enable in a known stable scene to reset preference state. Board restart loses
memory and requires a fresh two-correction demonstration. Never flash automatically.

## Boundaries and outstanding validation

Source path: ManualScreen.dial/useAppStore.setValue -> HardwareDeviceService.set/flush
-> POST /api/control -> server command ID1 -> MicSpeakerBridge.PollAppCommand ->
10-byte A5 5A frame/CRC -> PC_Audio_Poll -> Controls_Command/manual override.
Explicit confirmation uses confirmNoiseReduction -> waits for pending writes and
checks final desired/acknowledged value -> ONE feedback request, no redundant setter ->
/api/noise-feedback -> same queue ID14 -> Adaptive_Command ->
adaptive_runtime_correct -> pl_correct_masked(output0). IDs15/16 use
setNoiseAdaptation/clearNoisePreferences and /noise-adaptation /noise-preferences.
Controls_AdaptiveAck -> Controls_BeginBlock -> MIC4 -> ReportStatus -> JSON ->
/api/status -> HardwareConnection updates appliedNoiseReduction/displayed dial
through setState without setters.
Inference: actual input RMS -> Adaptive_ObserveBlock mailbox -> foreground Poll ->
runtime prediction -> Controls_SetAdaptiveStrength -> BeginBlock -> Noise_SetStrength.

C# frame serialization/retry and firmware parser/ack linkage were inspected, not
physically exercised. No ARM toolchain or connected target validation was available;
no measured target CPU/RAM/flash conclusions follow. App dependencies are absent,
so lint/typecheck/Expo build are pending; direct dependency-free app tests can run.
App dials are locked during confirmation/reset. No authoritative ML capability/mode
telemetry exists. Automatic-on-slider-release correction remains app-team work; do not
combine it with duplicate Remember events when integrated. Revalidate against that
revision with its owner. No teammate files were edited for this compatibility fix.
