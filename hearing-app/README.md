# Hearing App

Expo and React Native companion app. In the browser on the USB-connected Windows
PC, controls use a real local bridge to the STM32. Native/mobile builds retain
explicitly labeled mock controls.

## Control the connected STM32

Use the app-control firmware and current two-microphone wiring described in
[hardware app setup](../audio_passthrough/APP_CONTROL.md). After `npm ci`, run
`.\scripts\start-hardware-app.ps1` from the repository root and open
http://localhost:8081. Choose **Connect USB** to apply saved settings and use
the dials. Volume, noise-reduction strength, speech-band gain and EQ run on the
STM32; **Relearn noise** resets its NLMS filter. Spatial Focus is disabled because
this microphone configuration has no directional-processing implementation.
The connection panel displays live microphone levels and reports missing clocks
or a stopped stream. A disconnected dial saves its desired value without
claiming to have changed hardware. Use the helper's `-Stop` switch to stop it.

## Run

```sh
npm ci
npm start
```

From the Expo terminal, press `a` for an Android emulator or `i` for an iOS simulator. You can also run `npm run android` or `npm run ios`. Expo SDK 58 requires Node.js 22.13+ or 24.3+; Android native builds require Android Studio and the Android SDK, and iOS native builds require macOS and Xcode.

For a phone-sized preview on this computer, run `npm run web`, open the localhost URL shown by Expo in Chrome, then open DevTools and toggle the device toolbar (`Ctrl+Shift+M`). Choose an iPhone-sized viewport such as 393 × 852. This runs the same React Native screens in a browser; iOS-only behavior such as native haptics still needs a real iPhone or an iOS simulator on macOS.

## Checks

```sh
npm run typecheck
npm run lint
npm test
```

## Structure

- `app.config.ts`: placeholder display name, slug, native application IDs, and cream/black system UI and blank splash configuration
- `constants/theme.ts`: colors, typography, spacing, and sizing
- `src/app`: Expo Router routes for Home, Manual, Our Mission, and feedback settings
- `src/feedback`: throttled haptics and preloaded local UI sounds
- `src/navigation`: shared segmented route switch
- `src/screens`: Home, Manual, Our Mission, and feedback settings layouts
- `src/components`: reusable SVG rotary dial and circular gesture logic
- `src/device`: transport interface, real browser USB-bridge transport, native mock implementation, and binding
- `src/state`: one Zustand app store with AsyncStorage persistence, plus session-only connection state

Connections are session-only. The last device ID is stored locally; a restart
never claims a live connection. The browser uses the USB audio bridge and
acknowledged firmware DSP controls. Hearing calibration and AI are not
implemented. The current hardware does not define a BLE radio or GATT protocol;
mobile hardware transport needs those additions and a development build.

The Volume dial updates local state immediately and sends a command through
`DeviceTransport`. In the connected browser it changes the STM32 PCM gain; in
native preview it remains simulated. **Relearn noise** resets the real NLMS
coefficients and checks for reference audio over two seconds, without producing
a hearing profile. `RotaryDial` has a 270° sweep and accessible adjustment actions.

Manual mode has Volume, Reduce Loud Sounds, Background Noise Reduction, Spatial
Focus, and Speech Amplification dials. MIC4 firmware applies all five controls.
Spatial Focus blends a broadside microphone sum at the 38 mm spacing, with
noise cancellation and relearning paused while focus is nonzero. It controls
the directional blend rather than a calibrated angle. Both microphones should
face the same way. Reduce Loud Sounds compresses sustained peaks and limits
digital transients. The two new controls default to zero; previously simulated
spatial settings are reset during saved-state migration. Advanced
has Bass, Mid and Treble plus a seven-point EQ editor; Treble uses a 4 kHz shelf
because the 8 kHz point is Nyquist at 16 kHz sampling. Settings are saved with
AsyncStorage and applied through the selected transport. The graph and waveform
are illustrative, not measured audio. The store also persists mode and feedback
preferences; learning progress and connection state remain session-only.

Settings lets the user turn haptics and sounds on or off; haptics default on and sounds default off. Dial steps, mode changes, and mock recalibration use brief feedback when enabled. Bundled sound cues are short and low amplitude, player volume is limited to 18%, and playback follows the device's silent mode. Feedback does not change system volume, request microphone access, or play in the background. Reduced Motion suppresses haptics; active screen readers suppress UI sounds so spoken feedback is not interrupted.
