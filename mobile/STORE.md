# Store submission guide

What is already configured in this repo, and the manual steps left for
Google Play and the App Store.

## Already done in this repo

- Android targets SDK 35 (current Play requirement), permissions are
  INTERNET only
- App icons, adaptive icons, and splash screens generated into android/ from
  `assets/icon.svg`. To regenerate after editing the SVG:
  `node scripts/make-assets.cjs && npx capacitor-assets generate --android`
  (add `--ios` on macOS once the ios platform exists)
- Release signing wired up: android/app/build.gradle reads
  android/keystore.properties (gitignored) when present
- Version: versionCode / versionName in android/app/build.gradle
- Dark background + Android 15 edge-to-edge handling in capacitor.config.ts
- Privacy policy page: docs/privacy.html ->
  https://khanhnd61-vr.github.io/readitdown/privacy.html
- Store listing art: assets/store/play-icon-512.png (Play listing icon),
  assets/store/feature-graphic.png (Play feature graphic, placeholder),
  assets/icon-only.png (1024px, doubles as the App Store icon)
- iOS privacy manifest ready to add: ios-extras/PrivacyInfo.xcprivacy

## Decide before the first upload

The app ID is `app.readitdown.mobile`. Both stores freeze it at first
upload - it can never change afterwards. To use a different one, change it
now in capacitor.config.ts and in android/ (applicationId + namespace in
app/build.gradle, package of MainActivity.java), or just delete android/ and
re-run `npx cap add android` after editing capacitor.config.ts (then re-apply
the signing config and `npx capacitor-assets generate --android`).

## Google Play

1. Create the upload keystore (once, keep it backed up outside git):

   ```sh
   cd android
   keytool -genkey -v -keystore upload.keystore -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   cp keystore.properties.example keystore.properties  # then fill it in
   ```

2. Build the bundle (needs Android Studio or SDK + JDK 21):

   ```sh
   npm run build && npx cap sync android
   cd android && ./gradlew bundleRelease
   # -> android/app/build/outputs/bundle/release/app-release.aab
   ```

3. Play Console (one-time $25 fee): create the app, upload the .aab, enable
   Play App Signing (default).

4. Required forms - truthful answers for this app:
   - Privacy policy URL: the page above
   - Data safety: no data collected, no data shared (favorites/recents are
     on-device only)
   - Ads: no
   - App access: all functionality available without login
   - Content rating questionnaire: utility/reference app -> Everyone
   - Target audience: 13+, not designed for children

5. Store listing: short + full description, listing icon and feature graphic
   from assets/store/, and at least 2 phone screenshots (take them on an
   emulator/device; also 7" and 10" tablet screenshots if you opt into
   tablets).

## Apple App Store (macOS required)

1. Join the Apple Developer Program ($99/year). Install Xcode + CocoaPods.

2. Generate the platform and assets:

   ```sh
   npx cap add ios
   npm run build && npx cap sync ios
   npx capacitor-assets generate --ios
   npx cap open ios
   ```

3. In Xcode:
   - Signing & Capabilities: select your team; bundle id
     app.readitdown.mobile
   - Drag ios-extras/PrivacyInfo.xcprivacy into App/App (check "Add to
     target: App"). It declares: no tracking, no data collected, UserDefaults
     used with reason CA92.1 (app preferences)
   - Info.plist: declare the app only uses exempt (HTTPS) encryption so
     uploads skip the export compliance question:

     ```xml
     <key>ITSAppUsesNonExemptEncryption</key>
     <false/>
     ```

4. Product -> Archive -> Distribute App -> App Store Connect.

5. In App Store Connect:
   - App Privacy: "Data Not Collected"
   - Privacy policy URL + support URL (use the GitHub Pages site)
   - Screenshots for the required iPhone sizes (and iPad if you keep iPad
     support enabled; the app is responsive so iPad is fine to keep)
   - Review notes: viewer for public GitHub repositories; no login; content
     is fetched read-only from api.github.com / raw.githubusercontent.com

## Each release after the first

- Android: bump versionCode (+1 every upload) and versionName in
  android/app/build.gradle
- iOS: bump Version / Build in Xcode
- Keep both in sync with package.json "version" for sanity
