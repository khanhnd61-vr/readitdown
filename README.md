# ReadItDown

Minimal markdown viewer. Tauri 2 + Svelte 5 + CodeMirror 6.

## Features

- Folder tree sidebar, open any directory
- Multiple tabs per pane, split panes side by side, drag divider to resize
- Edit while viewing: CodeMirror on the left, live preview on the right, Ctrl+S to save
- Create new files (nested paths like `notes/new.md` work)
- Two view modes per pane: wrap lines, or cut off with a horizontal scrollbar
- Renders embedded HTML and images (png, jpg, gif, ...)
- Links: external URLs open in the browser, relative `.md` links open in a tab,
  `/absolute` links resolve from the opened folder, `#anchors` scroll

## Prerequisites

Both platforms need Rust and Node.js:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Node.js: any recent LTS (from [nodejs.org](https://nodejs.org), nvm, or brew).

### Linux (Ubuntu/Debian)

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libdbus-1-dev
```

### macOS

```sh
xcode-select --install
```

No other system packages; the webview (WKWebView) ships with macOS.

## Run

Same on Linux and macOS:

```sh
npm install
npm run tauri dev
```

Open the `sample/` folder to try every feature.

## Build

Same command on both platforms, artifacts differ:

```sh
npm run tauri build
```

Artifacts land in `src-tauri/target/release/`:

- `readitdown` - the plain binary
- `bundle/` - installable packages
  - Linux: deb, rpm, AppImage
  - macOS: `macos/ReadItDown.app`, `dmg/ReadItDown_*.dmg` (for the host arch; on Apple
    Silicon add `-- --target universal-apple-darwin` to build a universal binary)
 
## CLI usage

```sh
readitdown        # open the app (welcome screen)
readitdown .      # open the current folder
readitdown ~/docs # open a specific folder
```

`readitdown` detaches from the terminal (release builds), so the prompt returns
immediately. Set `READITDOWN_FOREGROUND=1` to keep it attached.

## Install

### Linux

Pick one:

```sh
# deb (Ubuntu/Debian): installs /usr/bin/readitdown + desktop entry,
# remove with `sudo apt remove read-it-down`
sudo apt install ./src-tauri/target/release/bundle/deb/ReadItDown_0.1.0_amd64.deb

# no sudo: copy the binary onto your PATH
install -Dm755 src-tauri/target/release/readitdown ~/.local/bin/readitdown

# AppImage: portable single file, bundles its own libs
chmod +x src-tauri/target/release/bundle/appimage/ReadItDown_0.1.0_amd64.AppImage
```

rpm-based distros: use `bundle/rpm/ReadItDown-0.1.0-1.x86_64.rpm`.

### macOS

Build on a Mac (see the DMG note under [Build](#macos-dmg-step-needs-automation-permission)),
then either:

- copy `src-tauri/target/release/bundle/macos/ReadItDown.app` to `/Applications` yourself:

  ```sh
  cp -R src-tauri/target/release/bundle/macos/ReadItDown.app /Applications/
  ```

- or, if you produced a `.dmg`, open
  `src-tauri/target/release/bundle/dmg/ReadItDown_0.1.0_*.dmg` and drag ReadItDown to
  Applications

The app is unsigned, so the first launch needs right-click -> Open (or allow it under
System Settings -> Privacy & Security).
