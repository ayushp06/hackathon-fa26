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
- `src/app`: Expo Router routes for Automatic Calibration and Manual
- `src/navigation`: shared segmented route switch
- `src/screens`: screen foundations and a local rotary dial preview on Automatic Calibration
- `src/components`: reusable SVG rotary dial and circular gesture logic
- `src/device`: device service interface, mock implementation, and implementation binding
- `src/state`: Zustand state and AsyncStorage persistence of the last device ID

The mock connection is session-only. The last device ID is stored locally; a restart never claims a live connection. No gain, audio, AI, or DSP controls are implemented. The current hardware documents do not define a BLE radio or GATT protocol. Real BLE needs those details, a native BLE package, platform permissions, and an Expo development build. Expo Go cannot load an arbitrary native BLE package.

The rotary dial preview changes only local screen state. It does not adjust device output. `RotaryDial` accepts `min`, `max`, `step`, `diameter`, `label`, `value`, and `onValueChange`; its 270° sweep leaves a gap at the bottom. Screen readers can increment or decrement it as an adjustable control.
