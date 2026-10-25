# App-to-ML feedback contract

Firmware under test is pinned to `ba961a4`, not this branch's newest docs/tool commits.
App/server inspected and merged from `origin/main` at `5f4b4f4`.
The app now implements explicit feedback and mode routes; firmware remains unchanged.
See [two-context runbook](two-context-demo.md) for validation limits and results.

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

The Node API now routes POST `/api/noise-feedback` `{value:N}` to ID 14,
`/api/noise-adaptation` `{enabled:boolean}` to ID 15, and
`/api/noise-preferences` `{}` to ID 16 through the same `command` queue as ordinary
controls. All wait for matching sequence/status; rejects/timeouts propagate.
MIC4 has no ML capability bit: protocol=4 does not prove AUDIO_ADAPTIVE_ML is enabled.
Model counters/context/mode still require debugger inspection.

## Current app responsibilities and remaining gaps

`ManualScreen.dial` -> `useAppStore.setValue` -> `setNoiseReduction` sends ordinary
ID 1 only. `Remember this adjustment` invokes `confirmNoiseReduction`, which awaits
another final ordinary setter, checks desired value is unchanged, then submits ONE
feedback request. `set`/`flush` coalesce ordinary writes over 60 ms. No service retry
creates additional corrections; bridge retries reuse the sequence. An HTTP timeout
is ambiguous: inspect counters/ack before another user confirmation.

`HardwareConnection` polls `getStatus` and directly sets only `appliedNoiseReduction`;
this emits no setter. Selected dial values remain desired values. The Manual screen
shows selected versus device target separately. Resume/Pause/Clear buttons call the
three dedicated service methods; these are hardware-specific methods, not additions
to the generic mock DeviceService API.

`useAppStore.onRehydrateStorage`, `HardwareDeviceService.connect`/`restart`, and
`restoreProfile` can send ID 1 without training and pause autonomy. Complete these
BEFORE learning. No automatic correction is sent during hydration or telemetry.
The UI does not expose authoritative ML mode: success text is a past acknowledgment,
not current mode. Dials remain editable while confirmation is pending; a change
after the desired-value check can enqueue ID 1 after ID 14 and pause autonomy.
Keep controls idle during confirmation and recall. Coordinate a future UI locking
fix with the app owner rather than changing teammate code in this task.

Remaining dependencies: explicit ML capability/mode/context/counter telemetry,
context/time and playback-latency alignment, calibrated baseline import, physical
transport verification. The embedded baseline is still fixed 50, not an app profile.

Host coverage: `tests/hardware_server.test.mjs` exercises actual routes/queue with
an emulated status file; `hardwareDeviceService.test.mjs` covers final-setter ack
ordering. `adaptive-ml/tests/app-queue.test.mjs` additionally connects the actual
service through real HTTP to the actual server and command file, verifying IDs,
unique sequences, coalescing, rejection and telemetry without writes. Its status
publisher emulates firmware acknowledgments; it does NOT run C# serial or hardware.
