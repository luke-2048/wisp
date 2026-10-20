import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { renderStill, type PaletteName } from '../character';
import { it } from '../i18n/it';
import type { Settings, Snapshot } from '../island/snapshot';
import { shortcutLabel } from '../shared/shortcut';
import './settings.css';

// The settings window. Every change is sent to Rust at once (no "Save"
// button); Rust checks it, stores it and answers with the values it kept.
const t = it.settings;
const PALETTES: PaletteName[] = ['lilla', 'menta', 'pesca'];

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `
    <header>
      <span class="logo"></span>
      <h1>${t.title}</h1>
    </header>

    <section>
      <h2>${t.look}</h2>
      <div class="field-label">${t.palette}</div>
      <div class="palettes">
        ${PALETTES.map(
          (name) => `
          <button class="palette" data-palette="${name}">
            <span class="swatch"></span>
            <span>${t.palettes[name]}</span>
          </button>`,
        ).join('')}
      </div>
    </section>

    <section>
      <h2>${t.ideas}</h2>
      <div class="row">
        <span class="field-label">${t.shortcut}</span>
        <button class="shortcut"></button>
      </div>
      <div class="help shortcut-help">${t.shortcutHelp}</div>
    </section>

    <section>
      <h2>${t.timer}</h2>
      <label class="row">
        <span class="field-label">${t.customMinutes}</span>
        <span><input class="number" name="custom_minutes" type="number" min="1" max="240" /> ${t.minutes}</span>
      </label>
      <label class="row">
        <span class="field-label">${t.breakAfter}</span>
        <span><input class="number" name="break_after_minutes" type="number" min="15" max="240" /> ${t.minutesOfFocus}</span>
      </label>
    </section>

    <section>
      <h2>${t.night}</h2>
      <div class="row">
        <span class="field-label">${t.nightFrom}</span>
        <span>
          <input class="time" name="night_start" type="time" />
          ${t.nightTo}
          <input class="time" name="night_end" type="time" />
        </span>
      </div>
    </section>

    <footer>${t.autosave}</footer>`;

  setup(app);
}

function setup(root: HTMLElement) {
  let current: Settings | null = null;
  /** True while the shortcut button waits for a new combination. */
  let recording = false;
  const shortcut = root.querySelector<HTMLButtonElement>('.shortcut')!;
  const shortcutHelp = root.querySelector<HTMLDivElement>('.shortcut-help')!;
  const fields = [...root.querySelectorAll<HTMLInputElement>('input[name]')];

  // Paint each swatch in its own palette, the logo in the chosen one.
  for (const name of PALETTES) {
    const swatch = root.querySelector<HTMLSpanElement>(`.palette[data-palette="${name}"] .swatch`)!;
    renderStill(swatch, { palette: name, size: 38 });
  }
  const logo = root.querySelector<HTMLSpanElement>('.logo')!;
  let logoPalette: PaletteName | null = null;

  const draw = (settings: Settings) => {
    current = settings;
    if (settings.palette !== logoPalette) {
      logoPalette = settings.palette;
      renderStill(logo, { palette: settings.palette, size: 34 });
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('.palette')) {
      button.classList.toggle('chosen', button.dataset.palette === settings.palette);
    }
    if (!recording) shortcut.textContent = shortcutLabel(settings.park_shortcut);
    for (const input of fields) {
      // Don't overwrite what the user is typing right now.
      if (document.activeElement !== input) {
        input.value = String(settings[input.name as keyof Settings]);
      }
    }
  };

  /** Sends a change; Rust answers with the stored settings or an error code. */
  const save = async (change: Partial<Settings>): Promise<string | null> => {
    if (!current) return null;
    try {
      draw(await invoke<Settings>('update_settings', { settings: { ...current, ...change } }));
      return null;
    } catch (code) {
      return String(code);
    }
  };

  // ---- Palette ----
  for (const button of root.querySelectorAll<HTMLButtonElement>('.palette')) {
    button.addEventListener('click', () =>
      save({ palette: button.dataset.palette as PaletteName }),
    );
  }

  // ---- Numbers and times: saved when the field is left or Enter is pressed ----
  for (const input of fields) {
    input.addEventListener('change', () => {
      const value = input.type === 'number' ? Number(input.value) : input.value;
      void save({ [input.name]: value }).then(() => {
        if (current) input.value = String(current[input.name as keyof Settings]);
      });
    });
  }

  // ---- Shortcut: click, then press the new combination (Esc cancels) ----
  const stopRecording = (help: string = t.shortcutHelp, isError = false) => {
    recording = false;
    shortcut.classList.remove('recording');
    shortcutHelp.textContent = help;
    shortcutHelp.classList.toggle('error', isError);
    if (current) shortcut.textContent = shortcutLabel(current.park_shortcut);
  };
  shortcut.addEventListener('click', () => {
    recording = true;
    shortcut.classList.add('recording');
    shortcut.textContent = t.recording;
  });
  shortcut.addEventListener('blur', () => recording && stopRecording());
  shortcut.addEventListener('keydown', (event) => {
    if (!recording) return;
    event.preventDefault();
    if (event.key === 'Escape') return stopRecording();
    const key = keyName(event.code);
    if (!key) return; // only a modifier so far: keep waiting
    if (!event.ctrlKey && !event.altKey) return stopRecording(t.needsModifier, true);
    const parts = [
      event.ctrlKey && 'CommandOrControl',
      event.altKey && 'Alt',
      event.shiftKey && 'Shift',
      key,
    ].filter(Boolean);
    void save({ park_shortcut: parts.join('+') }).then((error) => {
      if (error === 'taken') stopRecording(t.shortcutTaken, true);
      else if (error) stopRecording(t.shortcutInvalid, true);
      else stopRecording();
    });
  });

  void invoke<Snapshot>('current_snapshot').then((snapshot) => draw(snapshot.settings));
  void listen<Snapshot>('wisp://state', (event) => draw(event.payload.settings));
}

/** Physical key -> accelerator name: letters, digits, Space, F1-F12. */
function keyName(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1];
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) return digit[1];
  if (code === 'Space') return 'Space';
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  return null;
}
