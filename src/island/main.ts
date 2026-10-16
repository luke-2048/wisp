import { listen } from '@tauri-apps/api/event';
import { palettes } from '../character/colors';
import { renderWisp } from '../character/wisp';
import { it } from '../i18n/it';
import './island.css';

// The island draws what the backend tells it: Rust watches the cursor and sends
// `wisp://island` to open or close it. The palette is fixed to Lilla until
// settings arrive (step 6); task and timer are placeholders until step 4.
const palette = palettes.lilla;

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `
    <div class="island" style="--palette-base:${palette.base}">
      <div class="shape">
        <div class="bar">
          <span class="mini">${renderWisp({ palette, id: 'mini', mini: true })}</span>
          <span class="timer">
            <span class="dot"></span>
            <span class="minutes">${it.island.noTimer}</span>
          </span>
        </div>
        <div class="panel">
          <div class="full">${renderWisp({ palette, id: 'full' })}</div>
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
  void listen<{ open: boolean }>('wisp://island', (event) => {
    island?.classList.toggle('open', event.payload.open);
  });

  scheduleBlinks(app);
}

/** Wisp blinks every 3-6 s, at random so it feels alive rather than mechanical. */
function scheduleBlinks(root: HTMLElement) {
  const delay = 3000 + Math.random() * 3000;
  window.setTimeout(() => {
    for (const eyes of root.querySelectorAll('.wisp-eyes')) {
      eyes.classList.add('blink');
      window.setTimeout(() => eyes.classList.remove('blink'), 160);
    }
    scheduleBlinks(root);
  }, delay);
}
