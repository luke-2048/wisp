import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { renderStill, type PaletteName } from '../character';
import { it } from '../i18n/it';
import type { Snapshot } from '../island/snapshot';
import './park.css';

// The park window: one field. Enter keeps the idea, Esc throws it away; in
// both cases Rust hides the window and gives the focus back to the app the
// user was working in.

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `
    <div class="park">
      <span class="icon"></span>
      <input class="field" type="text" maxlength="500" placeholder="${it.park.placeholder}"
        aria-label="${it.park.title}" spellcheck="false" />
      <span class="hint">${it.park.hint} ↵</span>
    </div>`;

  // The icon follows the palette chosen in the settings.
  // It stays still: this window is about typing fast, not about Wisp.
  const icon = app.querySelector<HTMLSpanElement>('.icon')!;
  let shown: PaletteName | null = null;
  const paint = (palette: PaletteName) => {
    if (palette === shown) return;
    shown = palette;
    renderStill(icon, { palette, size: 30 });
  };
  paint('lilla');
  void invoke<Snapshot>('current_snapshot').then((s) => paint(s.settings.palette));
  void listen<Snapshot>('wisp://state', (event) => paint(event.payload.settings.palette));

  const field = app.querySelector<HTMLInputElement>('.field')!;

  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const text = field.value.trim();
      void (text ? invoke('park_idea', { text }) : invoke('park_cancel'));
    }
    if (event.key === 'Escape') void invoke('park_cancel');
  });

  // Every time the shortcut opens the window: empty field, ready to type.
  const ready = () => {
    field.value = '';
    field.focus();
  };
  void listen('wisp://park', ready);
  void getCurrentWindow().onFocusChanged(({ payload: focused }) => focused && field.focus());
}
