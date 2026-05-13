# Production-shell vs dev-client crash audit — 2026-05-06

> Scope: identify why the iOS production shell aborts at launch while
> the dev-client shell launches the same JS code fine. **No code or
> config has been edited.** This is a diagnostic report only.

---

## 0. Build state at time of audit (this matters)

| Build | branding | `reactCompiler` | `usePushNotifications` | shipped to App Store? |
|---|---|---|---|---|
| **7** (the .ips files) | "Pictok" | `true` | enabled | yes — rejected |
| **8** (working tree, uncommitted/unsubmitted) | "Mony" | `false` | commented out | no |

The previous-session claim *"disabled `reactCompiler` and the crash
persists"* is **not yet verified**. Build 7 still had
`reactCompiler: true`. The change to `false` (commit `b0fe59d`) landed
*after* build 7 was uploaded. The next build will be the first that
actually tests the `reactCompiler: false` hypothesis — and it bundles
the push-disable change at the same time, which is a problem (see §6).

---

## 1. Latest crash log analysis

`uploads/crashlog-bisect-2026-05-06.ips` is a 0-byte placeholder. No
new crash log exists. Working from the two original logs (dated
2026-05-05 14:46 PDT, build 7).

Both share one root signature: **an Objective-C TurboModule method
threw an NSException during app startup.** The two manifestations:

**Log `7314F9AC` (faulting thread = `com.meta.react.turbomodulemanager.queue`):**

```
abort
__abort_message
demangling_terminate_handler
_objc_terminate
std::__terminate
__cxa_rethrow
objc_exception_rethrow
invocation function for block in ObjCTurboModule::performVoidMethodInvocation
```

The Obj-C method, dispatched as a void async method on the TM queue,
threw an NSException. The catch-and-rethrow path inside
`performVoidMethodInvocation` could not deliver the exception to a
running JS runtime (because the JS thread was still inside
`Hermes::makeHermesRuntime → Runtime::Runtime → initCharacterStrings`
— still building its initial heap). With nowhere to deliver, the
exception fell off the bottom of the C++ stack and called `terminate`.

The JS-thread frames in the same log show that the *outer* call chain
was: JS bytecode → `JSObject::getComputedWithReceiver_RJS` → JS
function call → another TM method (the synchronous
`performMethodInvocation` variant) → `[NSInvocation invoke]` → app
binary frames (unsymbolised) → `HermesRootAPI::makeHermesRuntime`.
That last hop — **a TurboModule synchronously creating a fresh Hermes
runtime** — is the fingerprint of `react-native-worklets` (used by
Reanimated 4) spawning its background runtime.

**Log `4E80B7A4` (faulting thread = `com.facebook.react.runtime.JavaScript`):**

`KERN_INVALID_ADDRESS at 0x000000000000000c` inside
`HadesGC::writeBarrierSlow` during a JS property assignment. The TM
queue (not the faulting thread, but visible) is concurrently in
`TurboModuleConvertUtils::convertNSExceptionToJSError →
createJSRuntimeError → ErrorConstructor → recordStackTrace → addOwnProperty`
i.e. *another* NSException is being converted to a JSError on the TM
queue at the same time the JS thread is running JS. The convert path
calls `jsi::Function::call` which mutates Hermes state — racing with
the JS thread's GC. Result: write barrier hits a torn pointer (`0xc`).

So both crashes start from the same trigger (Obj-C TurboModule throws
NSException at startup), but exit through two different failure
modes — terminate, or heap-corruption-then-segv.

---

## 2. Dev-client vs production-shell delta

### Config plugin injections from `expo-dev-client`

Read: [`node_modules/expo-dev-client/plugin/build/withDevClient.js`](node_modules/expo-dev-client/plugin/build/withDevClient.js),
[`withGeneratedIosScheme.js`](node_modules/expo-dev-client/plugin/build/withGeneratedIosScheme.js),
[`expo-dev-launcher/plugin/build/withDevLauncher.js`](node_modules/expo-dev-launcher/plugin/build/withDevLauncher.js),
[`expo-dev-menu/plugin/build/withDevMenu.js`](node_modules/expo-dev-menu/plugin/build/withDevMenu.js).

| Item | Injected by dev-client plugin? | In prod shell? |
|---|---|---|
| Generated URL scheme (Info.plist `CFBundleURLTypes`) | yes — `client://` | yes (same scheme set in `app.json`) |
| `DEV_CLIENT_TRY_TO_LAUNCH_LAST_BUNDLE` | only if `launchMode: "launcher"` set; not in your config | no |
| `aps-environment` entitlement | **no** | depends on expo-notifications plugin (see §4) |
| `NSLocalNetworkUsageDescription` | **no** (added separately by EAS Build for dev clients) | no |
| `NSBonjourServices` | **no** | no |
| `com.apple.developer.*` entitlements | **no** | no |

So the *config plugins* of `expo-dev-client` add basically nothing the
production shell wouldn't have. The actual dev-vs-prod delta is
elsewhere: the **provisioning profile**. Dev client builds are signed
with a development profile (lenient about declared entitlements); App
Store builds are signed with a distribution profile (strict — must
match what you declare).

This is why "missing entitlement" bugs almost always reproduce only in
prod shells.

---

## 3. Module-load native call inventory

Top of [`src/app/_layout.tsx`](src/app/_layout.tsx) and its eager imports:

| File:line | Statement | Native call? | Notes |
|---|---|---|---|
| [_layout.tsx:7](src/app/_layout.tsx:7) | `import * as SplashScreen from "expo-splash-screen"` | static module register | safe |
| [_layout.tsx:20](src/app/_layout.tsx:20) | `import ErrorBoundary` | JS only | safe |
| [_layout.tsx:21](src/app/_layout.tsx:21) | `import { initI18n } from "@/i18n"` | static module register | `i18n/index.ts` imports `expo-localization` (JS-only at module-load — `getLocales()` is called lazily inside `initI18n()`) |
| [_layout.tsx:22](src/app/_layout.tsx:22) | `import { syncAuthFromSupabase, … } from "@/stores/useAuthStore"` | **YES, transitively** | imports `@/lib/supabase`, which at top-level adds `AppState.addEventListener('change', …)` — TurboModule call to `RCTAppState`. Runs at module load. See [supabase.ts:24](src/lib/supabase.ts:24). |
| [_layout.tsx:23](src/app/_layout.tsx:23) (CURRENTLY COMMENTED) | `import { usePushNotifications }` | **YES, transitively** | The hook file at [usePushNotifications.ts:13](src/hooks/usePushNotifications.ts:13) executes `Notifications.setNotificationHandler({…})` at module top-level. In **build 7 (the crashed build) this WAS being executed.** |
| [_layout.tsx:24](src/app/_layout.tsx:24) | `import { useExchangeRatesRefresh }` | JS only at module-load | hook adds `AppState.addEventListener` only inside `useEffect` (after mount) |
| [_layout.tsx:25](src/app/_layout.tsx:25) | `import { typography } from "@/theme"` | JS only | safe |
| [_layout.tsx:27](src/app/_layout.tsx:27) | `SplashScreen.preventAutoHideAsync()` | TurboModule async-void | The Swift impl ([SplashScreenModule.swift](node_modules/expo-splash-screen/ios/SplashScreenModule.swift)) just sets two booleans. **Cannot throw** — eliminating splash screen as a candidate. |

After mount (in `useEffect`):

| Where | Native call |
|---|---|
| [_layout.tsx:80](src/app/_layout.tsx:80) | `initI18n()` → `Localization.getLocales()` (sync TM) + `AsyncStorage.getItem` (async TM) |
| [_layout.tsx:80](src/app/_layout.tsx:80) | `syncAuthFromSupabase()` → `supabase.auth.getSession()` (Keychain via AsyncStorage) |
| [_layout.tsx:83](src/app/_layout.tsx:83) | `subscribeToAuthChanges()` — JS callback registration |
| [_layout.tsx:88](src/app/_layout.tsx:88) | `useExchangeRatesRefresh()` → `AppState.addEventListener` |

Implicit at startup (not in user code, but in dependencies pulled by
imports):

- **`react-native-reanimated@4.1.1`** + **`react-native-worklets@0.5.1`**:
  Reanimated 4's installer initialises via TurboModule and spawns a
  background Hermes runtime via worklets. This matches the *exact*
  fingerprint in log `7314F9AC` (a TM call leading to
  `HermesRootAPI::makeHermesRuntime → Runtime::Runtime`). Reanimated's
  native module is auto-linked and loads regardless of whether your
  app uses any reanimated APIs at startup, because expo-router screens
  and many @gorhom/bottom-sheet / @react-navigation pieces import it.

---

## 4. `aps-environment` / push capability check

[`app.json`](app.json:75-80):

```json
[
  "expo-notifications",
  { "color": "#FF5A5C" }
]
```

No `mode` property is set. Reading
[`node_modules/expo-notifications/plugin/build/withNotificationsIOS.js:9`](node_modules/expo-notifications/plugin/build/withNotificationsIOS.js:9):

```js
const withNotificationsIOS = (config, { mode = 'development', sounds = [], … }) => {
    config = withEntitlementsPlist(config, (config) => {
        if (!config.modResults['aps-environment']) {
            config.modResults['aps-environment'] = mode;
        }
        return config;
    });
```

**Result:** every build of this app, including App Store builds,
declares `aps-environment = development`. The production
provisioning profile (a distribution profile from App Store Connect)
will be issued with `aps-environment = production`. **Mismatch.**

In practice this manifests one of two ways:

- EAS / fastlane gym signs the IPA with the entitlement value taken
  from the entitlements file. The push system rejects token
  registration but does not crash on first launch.
- On iOS 26 (where notification stack is rebuilt on UI Scenes), the
  mismatch can be fatal *the first time* `[UIApplication
  registerForRemoteNotifications]` is called → NSException → matches
  our crash signature.

But the crash happens at startup, *before* the user is logged in.
[usePushNotifications.ts:39](src/hooks/usePushNotifications.ts:39) gates
`registerForPushNotificationsAsync()` on `userId`, so on a fresh
install with no Supabase session there *is* no push register call.
The only top-level code is `Notifications.setNotificationHandler` —
which on Expo's iOS implementation is a JS-side handler registration
(it does not call `registerForRemoteNotifications`).

**Verdict:** the entitlement defaulting to `development` is a real,
ship-blocking bug — push notifications in production will not work.
But it is **unlikely to be the *cause* of the launch crash** (no
register-for-remote call happens at startup pre-login). Fix it
separately regardless.

**App Store Connect capability check (USER ACTION):**
Please verify at https://developer.apple.com/account → Certificates,
IDs & Profiles → Identifiers → `com.pictok.client` → Capabilities
that **Push Notifications is enabled**. If it is, the dev profile and
prod profile both have it; the entitlement string mismatch is purely
local. If it is *not* enabled, that is a second, independent problem.

---

## 5. `expo-splash-screen` iOS 26 compatibility

Read [`node_modules/expo-splash-screen/ios/SplashScreenModule.swift`](node_modules/expo-splash-screen/ios/SplashScreenModule.swift).
`preventAutoHideAsync` is three lines:

```swift
userControlledAutoHideEnabled = true
SplashScreenManager.shared.preventAutoHideCalled = true
return true
```

There is no throwing path. **Splash screen is ruled out as the
crash cause.**

---

## 6. `eas.json` profile diff

[`eas.json`](eas.json):

| Setting | development | production |
|---|---|---|
| `developmentClient` | `true` | (not set) ✓ |
| `distribution` | `internal` | (default = store) |
| `ios.resourceClass` | (default) | `m-medium` |
| `ios.image` | (default) | `latest` |
| `autoIncrement` | (not set) | `true` |

Nothing in `eas.json` looks anomalous. The `production` profile does
*not* inherit `developmentClient: true`. `m-medium` and `image: latest`
are both fine. No native build commands or extra plugin overrides.

---

## 7. Top suspect — ranked

| Hypothesis | Evidence | Strength |
|---|---|---|
| **react-native-worklets / Reanimated 4 spawning a child Hermes runtime via TurboModule, throwing in production-only code paths** | Log `7314F9AC` JS-thread stack literally contains the makeHermesRuntime / Runtime::Runtime / initCharacterStrings frames *underneath* an in-flight `[NSInvocation invoke]` from `ObjCTurboModule::performMethodInvocation`. This is the fingerprint of a TM that creates a JSI runtime. The only library in this app that does that at startup is worklets (Reanimated 4). | **HIGH** |
| **`reactCompiler: true` in build 7** | The previous session blamed it but never shipped a build that actually tested it. There is no direct stack-frame evidence connecting React Compiler to an Obj-C exception. React Compiler is a JS-side optimiser; it does not call into TurboModules. | **LOW** |
| **`usePushNotifications` import → `setNotificationHandler` at top-level** | Was loaded in build 7. But `setNotificationHandler` is JS-only on Expo's iOS impl — it does not call `registerForRemoteNotifications`. No native exception path. | **LOW** |
| **Missing `aps-environment = production` entitlement** | Definitely misconfigured (see §4). But the call site that would crash on this is gated behind login state, which doesn't run at first launch. | **LOW** as launch-crash cause; **HIGH** as a separate ship-blocker. |
| **Splash screen** | Source code rules it out. | **NONE** |

### Top suspect (one paragraph):

**Reanimated 4 + react-native-worklets initialising under a
TurboModule call.** Confidence **HIGH**, because log `7314F9AC` shows
an Obj-C `[NSInvocation invoke]` running `HermesRootAPI::makeHermesRuntime`
on the JS thread — exactly what `react-native-worklets` does to spin
up its background runtime. The crash itself is on the
TurboModule queue, where another TM's NSException can't unwind because
JS isn't ready. This setup is only ~6 months old in the wild; iOS 26
shipped after Reanimated 4.1.x; it is by far the youngest, least-tested
dependency in the boot path.

---

## 8. Recommended next single action

**Bisect the bisect.** The currently-staged build 8 changes *two*
variables at once (`reactCompiler` flipped to `false` AND
`usePushNotifications` commented out). With one rejection allowance
left, that is dangerous: a launch tells you "one of these mattered" and
a crash tells you "neither was sufficient" — both outcomes leave you
needing another build.

Do **one** thing before submitting build 8:

> **Revert the push-disable change** (uncomment line 23 and line 87 in
> [`src/app/_layout.tsx`](src/app/_layout.tsx)) so the *only* delta from
> build 7 to build 8 is `reactCompiler: false` and the Mony rebrand.
> Submit that.

**Why this and not the other way round:** the push-disable was a
shot-in-the-dark bisect proposed by a previous session; my §3+§4
analysis says push doesn't fire at fresh-install startup (gated on
`userId`), so removing it shouldn't matter. `reactCompiler: false` is
the change you *thought* you were testing. Test it cleanly.

**Expected outcomes that confirm or refute:**

- **Build 8 launches in production** → `reactCompiler: true` was the
  cause. Ship. Done. Investigate Reanimated/worklets at leisure.
- **Build 8 still crashes (same NSException signature)** → React
  Compiler was a red herring; the real cause is in the native boot
  path. The next experiment (build 9, after the next rejection) is to
  pin `react-native-reanimated` to 3.x or downgrade
  `react-native-worklets` and rebuild — this will definitively rule
  Reanimated 4 in or out.

**Independent of this:** before any *future* push-enabled build,
patch [`app.json`](app.json:76) to:

```json
[
  "expo-notifications",
  {
    "color": "#FF5A5C",
    "mode": "production"
  }
]
```

so `aps-environment` matches your distribution profile. This is not
the launch-crash fix, but it is a real bug that will silently break
push delivery once the app does ship.

---

*End of audit. No code or config has been edited.*
