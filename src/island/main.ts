import { palettes } from '../character/colors';
import { renderWisp } from '../character/wisp';
import { it } from '../i18n/it';
import './island.css';

// Closed island: a black bar glued to the top of the screen, with Wisp peeking
// out from underneath. The palette is fixed to Lilla until settings arrive
// (step 6); the timer is a placeholder until step 4.
const palette = palettes.lilla;

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `
    <div class="island">
      <div class="peek">${renderWisp({ palette, id: 'peek' })}</div>
      <div class="bar">
        <span class="timer">
          <span class="dot" style="background:${palette.base}"></span>
          <span class="minutes">${it.island.noTimer}</span>
        </span>
      </div>
    </div>`;
}
