# Wisp

[![CI](https://github.com/luke-2048/wisp/actions/workflows/ci.yml/badge.svg)](https://github.com/luke-2048/wisp/actions/workflows/ci.yml)

A tiny focus companion for Windows. Wisp is a soft little ghost that lives in a black
"island" at the top centre of your screen and helps you keep track of what you are doing:
the current task, the time passing, and the ideas that pop up halfway through.

It was designed with ADHD in mind: no manual logging, one thing at a time, no guilt, no
system notifications — Wisp changes mood instead. Everything stays on your computer.

> Status: v0.1. A macOS version (living under the notch) will follow as a separate project
> that reuses `crates/wisp-core`.

## What it does

- **The island.** A black bar at the top centre of the screen, with a tiny Wisp and the
  minutes left. Hover it and it opens: the current task, the timer and your parked ideas.
  When closed it never steals clicks or focus.
- **One task at a time.** Click "Su cosa stai lavorando?", type, Enter. "Fatto" celebrates,
  saves it to the history and stops the timer.
- **Focus timer.** 15, 25, 45 minutes or your own. When it ends Wisp rings softly and the
  bar blinks until you look at it.
- **Park ideas.** `Ctrl+Shift+Space` from any app opens a small field: type, Enter, and you
  are back where you were. The ideas wait in the island, with date and time.
- **Wisp's moods.** Focused, break (after 90 minutes of focus), waiting (timer over), done,
  night (23:00–05:00). Distracted is reserved for a future version.
- **Settings** from the tray: colour (Lilla, Menta, Pesca), shortcut, durations, night
  hours. Saved as you change them.

Everything is stored locally in `%APPDATA%\app.wisp.focus\wisp.sqlite3`.

## Screenshots

_To be added._

## Run it in development

Prerequisites (Windows):

- [Rust](https://rustup.rs) (stable, MSVC toolchain) with `clippy` and `rustfmt`
- Visual Studio Build Tools with the "Desktop development with C++" workload
- Node.js 20+
- WebView2 (already included in Windows 11)

```sh
npm install
npm run tauri dev
```

Checks:

```sh
cargo fmt --all --check
cargo clippy --workspace -- -D warnings
cargo test --workspace
npm run lint
npm run format:check
```

## Install

Download the Windows installer (`.exe` or `.msi`) from the
[Releases](https://github.com/luke-2048/wisp/releases) page. The app is not signed, so
Windows SmartScreen may warn you: choose "More info" → "Run anyway".

## Continuous integration and releases

- **CI** (`.github/workflows/ci.yml`): every push to `main` and every pull request runs the
  checks above on Windows.
- **Release** (`.github/workflows/release.yml`): pushing a `v*` tag builds the installers
  and publishes them in a GitHub release. To release a new version, set the same version in
  `package.json`, `Cargo.toml` (workspace) and `src-tauri/tauri.conf.json`, commit, then:

  ```sh
  git tag v0.1.1
  git push origin v0.1.1
  ```

## Project layout

```
crates/wisp-core/   platform-independent logic (state machine, timer, models)
src-tauri/          Tauri app: windows, tray, database, IPC commands
src/                frontend (Vite + TypeScript + SVG): draws, never decides
assets/wisp.svg     reference artwork for the character
docs/               original product brief
```

## License

[MIT](LICENSE)
