# ReadItDown Mobile

Markdown viewer for public GitHub repos, for iOS and Android. Enter a repo
(owner/name or URL), browse its markdown files, read them with an outline
panel for jumping between sections. Favorites and recents are saved on the
device.

Built with Capacitor 7 + Svelte 5 + TypeScript. No backend: the app talks to
the GitHub REST API directly (unauthenticated, public repos only).

## Develop

```sh
npm install
npm run dev        # runs in a desktop browser
npm run check      # svelte-check
npm run build      # web build into dist/
```

## Android

Needs Android Studio (or Android SDK + JDK 21).

```sh
npm run build
npx cap sync android
npx cap open android   # build/run from Android Studio
```

## iOS

Needs macOS with Xcode and CocoaPods.

```sh
npx cap add ios        # first time only
npm run build
npx cap sync ios
npx cap open ios       # build/run from Xcode
```

## Publishing

Store setup (signing, privacy, listing assets) is prepared; see
[STORE.md](STORE.md) for the submission checklist.

App icons and splash screens are generated from `assets/icon.svg`:

```sh
node scripts/make-assets.cjs
npx capacitor-assets generate --android   # --ios on macOS
```
