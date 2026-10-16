# Wisp

A tiny focus companion for Windows. Wisp is a soft little ghost that lives in a black
"island" at the top centre of your screen and helps you keep track of what you are doing:
the current task, the time passing, and the ideas that pop up halfway through.

It was designed with ADHD in mind: no manual logging, one thing at a time, no guilt, no
system notifications — Wisp changes mood instead. Everything stays on your computer.

> Status: v0.1 in development. A macOS version (living under the notch) will follow as a
> separate project that reuses `crates/wisp-core`.

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
[Releases](../../releases) page. Every `v*` tag is built automatically by GitHub Actions.

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
