# Jotter

A mobile data-collection app: capture photos, log structured data against them, and export to CSV. See `docs/architecture.md` for the full design, `docs/current-task.md` for what's currently being built, and `docs/schema.sql` for the database schema.

## Prerequisites

- Node.js, npm
- JDK 17
- Android SDK (build-tools, platform-tools, an emulator image or a physical Android device)

This project uses native modules (camera, SQLite, Google Sign-In, etc.), so it **cannot run in plain Expo Go** — it needs a custom dev client, built via `expo prebuild` + `expo run:android`.

## Setup

```bash
npm install
```

`.env.local` needs:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

Database: run `docs/schema.sql` against your Supabase project (SQL Editor, or `npm run db:push` after `npm run db:link` — see `supabase/migrations/`).

OAuth: Google and GitHub sign-in require providers configured in the Supabase dashboard first — see the Auth Model section of `docs/architecture.md`.

## Running locally

### First-time native build

```bash
npx expo prebuild --platform android
npx expo run:android
```

Re-run `prebuild --clean` whenever a new native module is added (camera, sensors, Google Sign-In, etc.) — it regenerates the `android/` project from `app.json`'s config plugins.

### Testing on an emulator

```bash
~/Android/Sdk/emulator/emulator -avd <your-avd-name>
npx expo run:android
```

Note: only emulator images with the **Google Play** badge force a Google account sign-in. **Google APIs** images (no Play Store icon) include Play Services — needed for the native Google Sign-In library — without requiring you to sign into an account on the emulator itself.

### Testing on a physical device (recommended: USB)

1. On the phone: **Settings → About Phone** → tap **Build Number** 7× → **Settings → Developer Options** → enable **USB Debugging**.
2. Plug the phone in via USB, allow the debugging prompt.
3. Confirm it's detected: `adb devices` (should show `device`, not `unauthorized`).
4. Build and install:
   ```bash
   npx expo run:android --host localhost
   ```

**Always use `--host localhost` when testing over USB.** The default (`--host lan`) tries to reach Metro over your computer's Wi-Fi LAN IP, which fails (silently — just a white screen, no error) if the phone's Wi-Fi is off or on a different network than the computer. `--localhost` routes through the USB `adb reverse` tunnel instead, working regardless of Wi-Fi state.

If you've already built and just want to restart the bundler:
```bash
npx expo start --localhost --dev-client
```

### Testing on a physical device (wireless, Android 11+)

Requires phone and computer on the same Wi-Fi network, and a one-time pairing:
```bash
adb pair <ip>:<port>       # from Settings → Developer Options → Wireless debugging → Pair device with pairing code
adb connect <ip>:<port>    # from the main Wireless debugging screen (different address than the pairing one)
adb devices                # confirm it shows up
npx expo run:android       # --host lan (default) is fine here, since it's already on Wi-Fi
```

### Web preview (local UI iteration only — not a shipped target)

```bash
npm run web
```

Useful for quickly checking screen layout/styling in a browser. Not a real deployment target (see "Platform" in `docs/architecture.md` — Android only) — anything native-only (camera, native Google Sign-In, etc.) won't function here.

## Troubleshooting

**White screen after install:**
1. Check `adb devices` — is the device actually connected?
2. Check the Metro terminal is still running and didn't error out.
3. If testing over USB with Wi-Fi off, make sure you used `--host localhost` (see above).
4. Pull logs to see the real error instead of guessing:
   ```bash
   adb logcat --pid=$(adb shell pidof com.m4tcha.jotter) -d -t 500 | grep -iE "ReactNativeJS|error|exception|fatal"
   ```
5. A `ClassNotFoundException` for an Expo module (e.g. `expo.modules.splashscreen.SplashScreenManager`) usually means a required package (like `expo-splash-screen`) isn't installed — install it, then `expo prebuild --clean` and rebuild.
6. Take a screenshot to see what's actually on screen:
   ```bash
   adb exec-out screencap -p > screenshot.png
   ```

**Anonymous ("Continue as Guest") sign-in fails:** confirm Anonymous Sign-Ins are enabled in Supabase → Authentication → Sign In / Providers.

**Google/GitHub sign-in fails:** confirm both providers are enabled in Supabase → Authentication → Providers, with the correct Client ID/Secret, and that `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set in `.env.local` for Google, and `jotter://**` is in Supabase's allowed Redirect URLs for GitHub.
