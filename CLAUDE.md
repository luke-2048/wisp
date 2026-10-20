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
- **The character** (`src/character/`, brief: `docs/WISP_personaggio.md`, behaviour
  reference: `docs/wisp-reference.html`) is driven by damped springs: the app changes
  _targets_, never values. `spring.ts`, `params.ts` (STATES, REACTIONS, ATTENTION, spring
  tuning), `geometry.ts` (pure: pose → SVG attributes) and `sim.ts` (no DOM; time and
  randomness passed in) are tested with Vitest. `render.ts` builds the SVG once and only
  sets changed attributes; `loop.ts` stops while the window is hidden; `input.ts` handles
  click, drag and caress. Use only `createWisp` / `renderStill` from `index.ts`.
  `playground.html` (dev only, not in the build) is for tuning:
  `http://localhost:1420/playground.html`.
- Wisp's gaze is not app state, so the frontend may follow the cursor: Rust sends
  `wisp://cursor` (window-relative CSS pixels) from the island polling thread every 40 ms,
  only when the cursor moved and the island is visible.

## Product rules (binding)

Zero manual logging (only the current task is required) · one thing at a time · no guilt
(no failure counters, no aggressive red) · no system notifications in v0.1 · all data stays
local.

## Decisions taken during planning

- `break` triggers after 90 min of cumulative running timer; only a pause/stop lasting at
  least 5 min resets the count.
- `night` runs from 23:00 to 05:00 (both configurable).
- The focus streak (for `break`) is running timer time; it resets only after 5 min with no
  timer running. "Fatto" also stops the timer (owner's choice).
- "Ti aspetta" clears when the island is opened or closed (either way the user saw it).
- Timer over ("Ti aspetta"): the closed bar blinks red (edge, mini Wisp, dot). This is the
  only red in the app, an explicit exception to "no aggressive red" asked by the owner.
- Park window (`park`, Ctrl+Shift+Space): Rust remembers the foreground window before
  showing it and gives the focus back _before_ hiding it (Windows only allows passing the
  focus on while we hold it). Clicking elsewhere just hides it. If the shortcut is taken by
  another app, Wisp still starts. The ideas counter counts unseen ideas.
- Sounds (Web Audio, synthesised in `src/island/sounds.ts`, no files): soft bells when the
  timer ends, a bright arpeggio for "Fatto!". `additionalBrowserArgs` in tauri.conf.json
  allows WebView2 to play them without a prior click.
- Island window: always 580x266 and never resized (resizing a WebView mid-animation drops
  frames); closed = click-through, Rust polls the cursor every 20 ms. The closed bar must
  never hide what is underneath (e.g. a browser tab's close button): with the cursor on it
  or within 24 px it fades to 15% (`.peek`), and the island opens only after the cursor
  rests 500 ms on the bar (owner asked for a bit longer than 350 ms); a mouse click on the closed bar goes to the window below and
  blocks opening until the cursor leaves the bar (`HoverTracker`, `Platform::mouse_button_down`).
  Once open, clicks are re-enabled and CSS animates the black shape (spring open, smooth
  close). Closes 80 ms after the cursor leaves (owner found the brief's 600 ms too slow).
- Closed island is only the 240x30 bar (owner's choice, overrides the brief's "Wisp peeks
  from under the bar"): mini Wisp on the left, minutes on the right. The mini Wisp glows
  softly or blinks red (`data-attention`, from `ATTENTION`) only when it has something to
  say (waiting, break, done). Step 3 (hover) was done before step 2 (states).
- Character in the island: the 24 px mini Wisp only follows the gaze and changes
  expression (the closed bar lets clicks through); click, elastic (~40 px down) and caress
  work on the 150 px Wisp in the open panel. At night, a nearby cursor makes it peek with
  the left eye only (`wink`). The sharp highlight is softer than in the reference (0.65)
  and all highlights are clipped to the body (owner's choice). Park and settings icons
  are still (`renderStill`).
- Default palette Lilla; Menta and Pesca selectable in settings.
- The island is **always top centre** (owner's rule): no "bottom right" position setting,
  although the brief mentions one.
- Settings are saved on every change (no Save button); Rust sanitises them
  (`Settings::sanitized`) and stores one row per field in `settings` (JSON values), so new
  fields just get their default. The park shortcut uses Tauri accelerator syntax with
  `CommandOrControl`, which the macOS version will read as Cmd.
- Data lives in `%APPDATA%\app.wisp.focus\wisp.sqlite3`; migrations in
  `src-tauri/src/db/migrations.rs` are append-only. A running timer is not restored after
  a restart (on purpose); task, ideas and settings are.
- Debug-forced state stays until "Automatico" is chosen in the debug submenu.

## Conventions

- Code, identifiers and comments in **English**; UI text in **Italian**, only in
  `src/i18n/it.json` (typed for the frontend by `it.ts`, read by Rust in
  `src-tauri/src/i18n.rs` for the tray menu).
- Closed island click-through goes through `Platform::set_click_through`: on Windows a
  click-through window is layered and stays invisible unless its opacity is set.
- Frontend: Vite + plain TypeScript + SVG, no UI framework.
- Before committing: `cargo fmt --all`, `cargo clippy --workspace -- -D warnings`,
  `cargo test --workspace`, `npm test`, `npm run lint`, `npm run format:check`.
- Default branch `main`. License MIT. Public repo: https://github.com/luke-2048/wisp
  (account `luke-2048`; commits use the GitHub noreply email set in the local git config).
- CI (`.github/workflows/ci.yml`) runs the checks above on `windows-latest` for every push
  and PR. Release: set the same version in `package.json`, `Cargo.toml` (workspace) and
  `src-tauri/tauri.conf.json`, commit, then push a `vX.Y.Z` tag; `release.yml` publishes
  the `.exe` and `.msi`. Never push a tag without the owner asking.
