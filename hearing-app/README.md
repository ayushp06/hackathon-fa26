# Hearing App

Temporary Expo and React Native companion app scaffold. It uses mock device communication and requires no hardware.

## Run

```sh
npm ci
npm start
```

From the Expo terminal, press `a` for an Android emulator or `i` for an iOS simulator. You can also run `npm run android` or `npm run ios`. Expo Go on a compatible physical device can open the QR code. An iOS simulator requires macOS and Xcode; an Android emulator requires Android Studio and the Android SDK.

## Checks

```sh
npm run typecheck
npm run lint
npm test
```

## Structure

- `app.config.ts`: placeholder display name, slug, and native application IDs
- `constants/theme.ts`: colors, typography, spacing, and sizing
- `src/app`: Expo Router routes for Automatic Calibration, Manual, and feedback settings
- `src/feedback`: throttled haptics and preloaded local UI sounds
- `src/navigation`: shared segmented route switch
- `src/screens`: Automatic Calibration and Manual layouts
- `src/components`: reusable SVG rotary dial and circular gesture logic
- `src/device`: transport interface, mock STM32-facing command implementation, and implementation binding
- `src/state`: one Zustand app store with AsyncStorage persistence, plus session-only connection state

The mock connection is session-only. The last device ID is stored locally; a restart never claims a live connection. No gain, audio, AI, or DSP controls are implemented. The current hardware documents do not define a BLE radio or GATT protocol. Real BLE needs those details, a native BLE package, platform permissions, and an Expo development build. Expo Go cannot load an arbitrary native BLE package.

The Volume dial updates local state immediately and sends a simulated command through `DeviceTransport`; it does not adjust physical device output. The Recalibrate button requests a simulated 800 ms operation through the same transport and stores a timestamped mock result locally. `RotaryDial` accepts `min`, `max`, `step`, `diameter`, `label`, `value`, optional `valueSuffix`, and `onValueChange`; its 270° sweep leaves a gap at the bottom. Screen readers can increment or decrement it as an adjustable control.

Manual mode has independent Base Volume, Background Noise Reduction, and Spatial Focus dials. Their 0–100% values are saved with AsyncStorage and sent to the mock transport. The automatic and manual volume values remain separate. The store also persists the active mode and feedback preferences, and migrates values saved by earlier versions. Calibration progress and live connection status stay session-only.

Settings lets the user turn haptics and sounds on or off; haptics default on and sounds default off. Dial steps, mode changes, and mock recalibration use brief feedback when enabled. Bundled sound cues are short and low amplitude, player volume is limited to 18%, and playback follows the device's silent mode. Feedback does not change system volume, request microphone access, or play in the background. Reduced Motion suppresses haptics; active screen readers suppress UI sounds so spoken feedback is not interrupted.
