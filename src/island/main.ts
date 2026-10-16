import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { palettes } from '../character/colors';
import { looks, type WispState } from '../character/states';
import { applyState, renderWisp } from '../character/wisp';
import { it } from '../i18n/it';
import './island.css';

// The island draws what the backend tells it:
// - `wisp://island` opens or closes it (Rust watches the cursor);
// - `wisp://state` says which state Wisp is in (Rust's state machine).
// The palette is fixed to Lilla until settings arrive (step 6); task and timer
// are placeholders until step 4.
const palette = palettes.lilla;

/** What the backend sends; step 4 adds task and timer. */
interface Snapshot {
  state: WispState;
}

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `
    <div class="island" style="--palette-base:${palette.base}">
      <div class="shape">
        <div class="bar">
          <span class="mini">${renderWisp({ id: 'mini', mini: true })}</span>
          <span class="timer">
            <span class="dot"></span>
            <span class="minutes">${it.island.noTimer}</span>
          </span>
        </div>
        <div class="panel">
          <div class="full">${renderWisp({ id: 'full' })}</div>
          <div class="details">
            <div class="label">${it.island.now}</div>
            <div class="task placeholder">${it.island.taskPlaceholder}</div>
            <div class="time">${it.island.noTime}</div>
            <div class="progress"><div class="progress-fill"></div></div>
          </div>
        </div>
      </div>
    </div>`;

  const island = app.querySelector<HTMLDivElement>('.island');
  const mini = app.querySelector<HTMLSpanElement>('.mini');
  const wisps = [...app.querySelectorAll<SVGSVGElement>('svg.wisp')];

  const show = (snapshot: Snapshot) => {
    for (const svg of wisps) {
      applyState(svg, snapshot.state, palette);
    }
    mini?.classList.toggle('attention', looks[snapshot.state].attention);
  };

  // Draw something right away, then ask the backend for the real state.
  show({ state: 'focused' });
  void invoke<Snapshot>('current_snapshot').then(show);
  void listen<Snapshot>('wisp://state', (event) => show(event.payload));
  void listen<{ open: boolean }>('wisp://island', (event) => {
    island?.classList.toggle('open', event.payload.open);
  });

  scheduleBlinks(wisps);
}

/** Wisp blinks every 3-6 s, at random so it feels alive rather than mechanical. */
function scheduleBlinks(wisps: SVGSVGElement[]) {
  const delay = 3000 + Math.random() * 3000;
  window.setTimeout(() => {
    for (const svg of wisps) {
      svg.classList.add('blink');
      window.setTimeout(() => svg.classList.remove('blink'), 160);
    }
    scheduleBlinks(wisps);
  }, delay);
}
