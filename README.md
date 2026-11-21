# RUN MIL! - Android app

The game is in `www/` (a copy of your game folder). Capacitor wraps it into a real Android app.

## Easiest: build the APK online (no installs)
1. Make a free GitHub account, create a new **private** repository, upload ALL the files of this folder (keep the hidden `.github` folder).
2. Open the repo > **Actions** > **Build Android APK** > wait ~5 minutes for the green check.
3. Open the finished run > **Artifacts** > download **RUN-MIL-apk** (a zip with `app-debug.apk`).
4. Send `app-debug.apk` to your phone and tap it. Android asks to allow "install unknown apps" for your file app / browser: allow it, then install.

## Or: build it on your PC with Android Studio
1. Install Android Studio and Node.js, then run `npm install` and `npx cap sync android` in this folder. 2. `File > Open` the `android` folder here. 3. Wait for Gradle to finish.
4. Plug in your phone (USB debugging on) and press the green Run button, or `Build > Build APK(s)`.

## After you change the game
Copy the changed game files into `www/`, then run `npx cap sync android` (needs Node.js) and build again.
