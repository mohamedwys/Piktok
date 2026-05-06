# Lock Sync Audit — package-lock.json regen after Reanimated bump

## package.json state (pre-install)

Both packages are pinned to caret ranges (not `"latest"`):

- `react-native-reanimated`: `^4.3.0`
- `react-native-worklets`: `^0.8.3`

These were updated as part of the iOS 26 launch crash fix
(react-native-worklets background Hermes runtime / TurboModule
NSException).

## Action

Run `npm install` to regenerate `package-lock.json` so EAS Build's
strict `npm ci` step passes.
