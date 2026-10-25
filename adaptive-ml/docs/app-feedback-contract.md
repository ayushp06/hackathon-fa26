# App-to-ML feedback contract

Firmware under test is pinned to `ba961a4`, not this branch's newest docs/tool commits.
App/server inspected from `origin/main` at `030728d` (Wavelength-v3 checkpoint).
This document proposes app integration; it does not add endpoints or firmware messages.

## Implemented path and wire contract

Browser `HardwareDeviceService.setNoiseReduction` -> POST `/api/control` with
`{control:"noiseReduction",value:N}` -> Node server's serialized command queue ->
`build/hardware-command.txt` -> sole serial-owning `MicSpeakerBridge.PollAppCommand`
-> firmware `PC_Audio_Poll` -> `Controls_Command` or `Adaptive_Command`.
Sources: `hearing-app/src/device/hardwareDeviceService.ts`, `scripts/hardware-server.mjs`,
`scripts/MicSpeakerBridge.cs`, `audio_passthrough/Core/Src/pc_audio.c`.

Frames: `A5 5A id value seq[4] crc[2]`; value signed int8, seq uint32 LE, nonzero for
ML commands, CRC16-CCITT-FALSE over first 8 bytes, CRC LE. Do not add a second parser
or serial owner. The player's existing three-field command file is `id value seq`.

| ID/value | Meaning at ba961a4 | Training |
| --- | --- | --- |
| 1 / integer 0..100 | Ordinary strength setter; pauses autonomy | Never |
| 14 / integer 0..100 | Explicit committed preferred strength for latest stable context; enables autonomy and holds for 2 s | Output 0 only |
| 15 / 0 or 1 | Disable/enable autonomy; does not clear memory | Never |
| 16 / 0 | Clear preference examples, disable autonomy, preserve current setting | Never |
| 10 / 0 | Reset NLMS noise coefficients, not preference memory | Never |
| legacy b/n | Bypass/enable NLMS; also pause preference autonomy | Never |

N maps to absolute model output `N/100`, then to existing smoothed NLMS subtraction
strength. It is not mu, dB, an adjustment delta or a baseline update. Output 1 is
unsupported, pinned to 0.5, and unselected by feedback. Spatial focus >0 prevents
NLMS preference inference/training. Reboot loses preference examples.

ID 14 needs no fault, a usable reference, a stable context (three 100 ms windows,
successive feature changes <=0.03) and context age <=250 ms. It uses the latest
firmware context at receive time; it accepts no context ID/timestamp. Retry the same
event with the same sequence, not a new one. Immediate retries and the last accepted
feedback sequence are deduplicated, not arbitrary historical replay. A rejected event
must not be silently retried later as a new user decision.

## Acknowledgment and observability

MIC4 is unchanged: 186 bytes; seq at offset 32, status at 46 (0 accepted, 1 rejected),
applied strength at 37 (`values.noiseReduction` in status JSON). Acknowledgment is
published by `Controls_BeginBlock`, not merely upon file/serial write. This value is
the applied target; the per-sample smoothing state is not exported. Player retries
unacknowledged files about every 250 ms and deletes them upon matching sequence.
`scripts/adaptive-feedback.ps1` uses that existing path and waits up to 4 s for status.

The Node API's ordinary `/api/control` waits for matching firmware seq/status, but
currently exposes only control IDs 0..13 plus its dedicated reset routes. It has no
learning-feedback, autonomy or preference-clear route. MIC4 also has no ML capability
bit: protocol=4 does not prove that AUDIO_ADAPTIVE_ML was compiled in. Old builds
reject the reserved ML IDs. Model counters/context/mode require debugger inspection.

## PROPOSED app responsibilities (not implemented)

1. Keep `setNoiseReduction` as non-training manual control. Hydration, connect/restart
   restoration and intermediate drag/accessibility steps must never become feedback.
2. Offer a deliberate confirmation such as "Remember this adjustment". Drag completion
   can stage a candidate; it alone is not proof of intentional supervision. Inspect
   `useRotaryGesture`/`RotaryDial` with the app team for a committed-action event.
3. Flush and await the final ordinary setter before enqueueing ONE confirmed ID 14
   event through the SAME server queue/serial owner. Allocate a unique sequence once
   per event, preserve it for transport retries, and propagate firmware rejection.
   No ID 1 write may follow the event inadvertently and pause autonomy again.
4. Expose explicit autonomy enable/disable (ID 15); resuming need not retrain. Preserve
   manual override until the user resumes or explicitly confirms a correction.
5. Track desired UI value separately from acknowledged applied value. Poll actual
   `values.noiseReduction`; updating the display from telemetry must not call a setter.
   Current transport coalesces changes over ~60 ms and resolves multiple callers with
   the last command's ack: that is not a record of each intermediate user's target.
6. Display "correction accepted" only after seq/status confirmation, not "learning
   improved". Applied target changes without user writes are consistent with recall
   but do not prove it. ML mode/context/counters and firmware capability reporting
   need a future coordinated protocol extension before a verified recall UI exists.

**Dependencies for app/server owners:** serialized feedback/mode routes; deliberate
confirmation semantics; surfaced command/result types; applied-vs-desired state;
capability discovery; context/time and playback-latency alignment. Endpoint names are
intentionally unspecified until agreed. Calibration baseline import is also absent.
For the current demo keep a stationary scene, use the existing debug helper with the
app/API idle, and do not change the device firmware or shared bridge to fill these gaps.
