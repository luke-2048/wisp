// Playground (development only): a big Wisp in free mode, buttons for states
// and palettes, sliders for the main springs. Open it at
// http://localhost:1420/playground.html while `npm run tauri dev` (or `npm run dev`) runs.

import { createWisp, type PaletteName, type WispState } from '../character';
import { palettes } from '../character/colors';
import { DEFAULT_TUNING, WISP_STATES, type Tuning } from '../character/params';
import { it } from '../i18n/it';
import './playground.css';

/** Stage background per palette, from the reference page. */
const BACKGROUNDS: Record<PaletteName, string> = {
  lilla: '#ECE8FB',
  menta: '#E3F4EF',
  pesca: '#FDEEE6',
};

const SIZE = 300;
type SpringName = 'expression' | 'look' | 'home' | 'squash';
const SPRINGS: SpringName[] = ['expression', 'look', 'home', 'squash'];

const app = document.querySelector<HTMLDivElement>('#app')!;
const text = it.playground;
app.innerHTML = `
  <main>
    <h1>${text.title}</h1>
    <p>${text.hint}</p>
    <div class="stage"><div class="home"></div></div>
    <div class="row" role="group" aria-label="${text.state}"></div>
    <div class="row" role="group" aria-label="${text.palette}"></div>
    <fieldset class="tuning"><legend>${text.tuning}</legend></fieldset>
  </main>`;

const stage = app.querySelector<HTMLDivElement>('.stage')!;
const home = app.querySelector<HTMLDivElement>('.home')!;
const [stateRow, paletteRow] = app.querySelectorAll<HTMLDivElement>('.row');
const tuningBox = app.querySelector<HTMLFieldSetElement>('.tuning')!;

const wisp = createWisp(home, { palette: 'lilla', size: SIZE, mode: 'free', area: stage });

/** Free mode: Wisp can be dragged anywhere inside the stage. */
function updateBounds() {
  const u = SIZE / 300;
  const halfW = stage.clientWidth / 2;
  const halfH = stage.clientHeight / 2;
  wisp.sim.bounds = {
    left: -(halfW - 120 * u) / u,
    right: (halfW - 120 * u) / u,
    top: -(halfH - 110 * u) / u,
    bottom: (halfH - 150 * u) / u,
  };
}
updateBounds();
new ResizeObserver(updateBounds).observe(stage);

/** A row of toggle buttons; exactly one is pressed. */
function buttons<T extends string>(
  row: HTMLElement,
  items: T[],
  label: (item: T) => string,
  pick: (item: T) => void,
) {
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label(item);
    button.addEventListener('click', () => {
      for (const other of row.children)
        other.setAttribute('aria-pressed', String(other === button));
      pick(item);
    });
    row.append(button);
  }
  row.firstElementChild?.setAttribute('aria-pressed', 'true');
}

buttons<WispState>(
  stateRow,
  [...WISP_STATES],
  (s) => it.states[s],
  (s) => wisp.setState(s),
);
buttons<PaletteName>(
  paletteRow,
  Object.keys(palettes) as PaletteName[],
  (p) => it.settings.palettes[p],
  (p) => {
    wisp.setPalette(p);
    stage.style.background = BACKGROUNDS[p];
  },
);
stage.style.background = BACKGROUNDS.lilla;

/** One slider; `read` and `write` go through the live tuning object. */
function slider(
  label: string,
  min: number,
  max: number,
  stepSize: number,
  read: () => number,
  write: (v: number) => void,
) {
  const row = document.createElement('label');
  const input = document.createElement('input');
  const value = document.createElement('output');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(stepSize);
  const show = () => {
    input.value = String(read());
    value.textContent = String(read());
  };
  input.addEventListener('input', () => {
    write(Number(input.value));
    value.textContent = input.value;
  });
  row.append(label, input, value);
  tuningBox.append(row);
  return show;
}

const refreshers: (() => void)[] = [];
const tuning = (): Tuning => wisp.sim.tuning;
for (const name of SPRINGS) {
  const title = text.springs[name];
  refreshers.push(
    slider(
      `${title} · ${text.stiffness}`,
      10,
      800,
      5,
      () => tuning()[name].k,
      (v) => (tuning()[name] = { ...tuning()[name], k: v }),
    ),
    slider(
      `${title} · ${text.damping}`,
      1,
      60,
      0.5,
      () => tuning()[name].c,
      (v) => (tuning()[name] = { ...tuning()[name], c: v }),
    ),
  );
}
refreshers.push(
  slider(
    text.turn,
    0,
    1.5,
    0.05,
    () => tuning().turn,
    (v) => (tuning().turn = v),
  ),
);

const reset = document.createElement('button');
reset.type = 'button';
reset.textContent = text.reset;
reset.addEventListener('click', () => {
  wisp.sim.tuning = structuredClone(DEFAULT_TUNING);
  refreshers.forEach((refresh) => refresh());
});
tuningBox.append(reset);
refreshers.forEach((refresh) => refresh());
