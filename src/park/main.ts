import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { palettes } from '../character/colors';
import { applyState, renderWisp } from '../character/wisp';
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
      <span class="icon">${renderWisp({ id: 'park', mini: true })}</span>
      <input class="field" type="text" maxlength="500" placeholder="${it.park.placeholder}"
        aria-label="${it.park.title}" spellcheck="false" />
      <span class="hint">${it.park.hint} ↵</span>
    </div>`;

  // The icon follows the palette chosen in the settings.
  const icon = app.querySelector<SVGSVGElement>('svg.wisp')!;
  const paint = (snapshot: Snapshot) =>
    applyState(icon, 'focused', palettes[snapshot.settings.palette]);
  applyState(icon, 'focused', palettes.lilla);
  void invoke<Snapshot>('current_snapshot').then(paint);
  void listen<Snapshot>('wisp://state', (event) => paint(event.payload));

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
