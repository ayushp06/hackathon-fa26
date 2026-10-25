# Hearing App

Expo and React Native companion app. Device communication is mocked; the experimental hearing test plays local tones only when a wired headset is detected.

## Run

```sh
npm ci
npm start
```

From the Expo terminal, press `a` for an Android emulator or `i` for an iOS simulator. You can also run `npm run android` or `npm run ios`. The wired headphone check uses a local native module, so real tone playback requires a development build (`npx expo run:android` or `npx expo run:ios`) and wired earbuds. Expo Go and web offer clearly labeled simulation mode with no audio or inferred hearing profile. Expo SDK 58 requires Node.js 22.13+ or 24.3+; Android native builds require Android Studio and the Android SDK, and iOS native builds require macOS and Xcode.

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
- `src/app`: Expo Router routes for onboarding, Automatic Calibration, Manual, and feedback settings
- `src/feedback`: throttled haptics and preloaded local UI sounds
- `src/navigation`: shared segmented route switch
- `src/screens`: onboarding, hearing test, Automatic Calibration, and Manual layouts
- `src/hearingTest`: imported report handling and the experimental tone plan/profile
- `modules/headphone-route`: native wired headset detection for the tone test
- `src/components`: reusable SVG rotary dial and circular gesture logic
- `src/device`: transport interface, mock STM32-facing command implementation, and implementation binding
- `src/state`: one Zustand app store with AsyncStorage persistence, plus session-only connection state

The mock connection is session-only. The last device ID is stored locally; a restart never claims a live connection. No hearing-audio calibration, AI, or DSP is implemented. The current hardware documents do not define a BLE radio or GATT protocol. Real BLE needs those details, a native BLE package, platform permissions, and an Expo development build. Expo Go cannot load an arbitrary native module.

The hearing test saves tone frequencies, relative playback levels, scenarios, taps, and timestamps locally. Its preliminary focus suggestion is experimental and non-diagnostic; phone audio is not calibrated in dB HL. The app never changes system volume. It plays a comfort-check tone at the highest test player level before starting and only uses equal or lower player levels afterward. Unplugging wired headphones pauses the test. Background noise is optional. Simulation mode never plays tones or generates a hearing profile.

The Volume dial updates local state immediately and sends a simulated command through `DeviceTransport`; it does not adjust physical device output. The Recalibrate button requests a simulated 800 ms operation through the same transport and stores a timestamped mock result locally. `RotaryDial` accepts `min`, `max`, `step`, `diameter`, `label`, `value`, optional `valueSuffix`, and `onValueChange`; its 270° sweep leaves a gap at the bottom. Screen readers can increment or decrement it as an adjustable control.

Manual mode has Volume, Background Noise Reduction, Spatial Focus, and Speech Amplification dials. Its Advanced section has Bass, Mid, and Treble dials plus a seven-point frequency response editor at 125, 250, 500, 1k, 2k, 4k, and 8k Hz. The four extra bands have accessible step buttons. Manual settings are saved with AsyncStorage and sent to the mock transport; the response and waveform are illustrative and no hardware DSP is applied. The store also persists the active mode and feedback preferences, and migrates values saved by earlier versions. Calibration progress and live connection status stay session-only.

Settings lets the user turn haptics and sounds on or off; haptics default on and sounds default off. Dial steps, mode changes, and mock recalibration use brief feedback when enabled. Bundled sound cues are short and low amplitude, player volume is limited to 18%, and playback follows the device's silent mode. Feedback does not change system volume, request microphone access, or play in the background. Reduced Motion suppresses haptics; active screen readers suppress UI sounds so spoken feedback is not interrupted.
