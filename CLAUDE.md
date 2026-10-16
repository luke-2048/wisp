# CLAUDE.md — conventions for Wisp

Product brief: `docs/WISP_windows_v0.1.md` (Italian). Read it before changing behaviour.

## Working with the owner

- The owner writes little code by hand and is learning Rust. When a Rust concept appears
  (ownership, borrowing, `Result`, traits, lifetimes), explain it in two lines in a code
  comment or in the message. No long lessons. Readable code beats clever code.
- Work in small steps, each runnable with `npm run tauri dev`, each with its own commit,
  and end each step with a short "what to try by hand" list.

## Architecture rules

- **Logic lives in Rust, the frontend only draws.** The backend emits `wisp://state`
  whenever the state changes; the frontend never decides the state.
- `crates/wisp-core` must never depend on Tauri or OS APIs: it will be reused by the macOS
  version. State machine functions are pure: the current time is always a parameter,
  never `now()` inside the logic.
- OS-specific code goes in `src-tauri/src/platform/` behind a common interface.
- `src-tauri/src/integrations/` holds the `Integration` trait only (v0.1).

## Product rules (binding)

Zero manual logging (only the current task is required) · one thing at a time · no guilt
(no failure counters, no aggressive red) · no system notifications in v0.1 · all data stays
local.

## Decisions taken during planning

- `break` triggers after 90 min of cumulative running timer; only a pause/stop lasting at
  least 5 min resets the count.
- `night` runs from 23:00 to 05:00 (both configurable).
- Closed island: click-through window + cursor polling from Rust; on hover the window
  grows to the open size at once and CSS animates the panel.
- Default palette Lilla; Menta and Pesca selectable in settings.
- Debug-forced state stays until "Automatico" is chosen in the debug submenu.

## Conventions

- Code, identifiers and comments in **English**; UI text in **Italian**, only in
  `src/i18n/it.json` (typed for the frontend by `it.ts`, read by Rust in
  `src-tauri/src/i18n.rs` for the tray menu).
- Closed island click-through goes through `Platform::set_click_through`: on Windows a
  click-through window is layered and stays invisible unless its opacity is set.
- Frontend: Vite + plain TypeScript + SVG, no UI framework.
- Before committing: `cargo fmt --all`, `cargo clippy --workspace -- -D warnings`,
  `cargo test --workspace`, `npm run lint`, `npm run format:check`.
- Default branch `main`. License MIT.
