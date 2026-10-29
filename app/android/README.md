# Android companion preview

An Android 8+ app for playing and viewing your existing Tokenmaxxing account. It wraps the live `/play`
game in an app-private WebView and offers QR scanning, paste-code sign-in, reload and local sign-out.
Desktop computers continue collecting and syncing tokens. The Android app does not read local agent
logs, run the desktop helper, create a separate account or receive a usage-import device token.

## Connect your account

1. On an already signed-in computer, open your player card and its Computers section.
2. Choose **Connect phone**. The QR and paste code work once and expire after two minutes.
3. On Android, choose **Scan** and scan that QR, or **Paste** and enter the code.
4. The phone receives its own game session, valid for up to 30 days, and opens your existing character.

**The server/web changes in this PR must be deployed before the Connect phone button is available.**
The APK loads `https://tokenmaxxing.dk` by default. Installing a PR build does not deploy its server.
QR scanning uses Google Play services and may need to download its scanner module on first use; no
camera permission is requested by the app. Paste works without Play services.

Signing out removes the session from this phone. It does not revoke the server token remotely or sign
out other devices; sessions still expire after 30 days. Remote session management and account recovery
without an existing desktop login are follow-ups.

## Build and install

Use JDK 21 and Android SDK platform 36 (set `ANDROID_HOME`, or create ignored `local.properties` with
`sdk.dir`). Run from this directory:

```sh
./gradlew testDebugUnitTest lintDebug assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

On Windows, use `gradlew.bat`. Output: `app/build/outputs/apk/debug/app-debug.apk`.
The debug APK is installable and signed with the build machine's development key. Its application ID
ends in `.debug` so it can coexist with a future release. Independently built debug APKs may have
different keys: to switch between local and CI builds, uninstall the old preview first (clears sign-in).
Production signing and Play Store publishing are not configured; do not use the preview key for releases.
CI does not build the APK or run its tests, so run the command above before merging Android changes.

To test another deployment with the companion changes:

```sh
./gradlew assembleDebug -PserverUrl=https://your-test-deployment.example
```

Only an HTTPS origin is accepted. The app refuses pairing URLs from any other origin, including
lookalike hosts, credentials in URLs, HTTP, unexpected ports and executable schemes. Both paste input
and QR output use the same validator. The pairing code is carried in the URL fragment, consumed by the
existing web sign-in flow and removed from history. QR images are generated locally in the web client.
There is no JavaScript/native bridge; file/content access and mixed content are disabled, third-party
cookies are disabled, and app backup is off. WebView retains the session in private origin storage.

## Validation and remaining device QA

The backend tests cover session pairing, replay prevention, permissions, ownership, rate limits and
bounded outstanding codes. The JVM tests cover valid input and phishing/executable URL rejection.
Run native Android lint and assemble as above, and run repository typecheck/lint and relevant tests.

Before release, test on a physical phone: scanner module availability/cancellation, paste, expired and
reused codes, relaunch with saved session, local sign-out, offline/retry, screen rotation, keyboard
insets, game touch controls and 2D fallback on a weak device. The game still has the existing mobile
HUD density limitations. Verified Android App Links, remote revocation and release signing are later work.
