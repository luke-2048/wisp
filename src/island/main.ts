import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { palettes } from '../character/colors';
import { looks } from '../character/states';
import { applyState, renderWisp } from '../character/wisp';
import { it } from '../i18n/it';
import './island.css';
import { panelHtml, setupPanel } from './panel';
import type { Snapshot } from './snapshot';

// The island draws what the backend tells it:
// - `wisp://island` opens or closes it (Rust watches the cursor);
// - `wisp://state` carries Wisp's state, the task and the timer.
// Between two snapshots the countdown runs on the local clock, only to keep
// the numbers moving; when the timer ends is decided in Rust.
// The palette is fixed to Lilla until settings arrive (step 6).
const palette = palettes.lilla;

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
          ${panelHtml()}
        </div>
      </div>
    </div>`;

  const q = <T extends Element>(selector: string) => app.querySelector<T>(selector)!;
  const island = q<HTMLDivElement>('.island');
  const mini = q<HTMLSpanElement>('.mini');
  const barTimer = q<HTMLSpanElement>('.timer');
  const minutes = q<HTMLSpanElement>('.minutes');
  const time = q<HTMLDivElement>('.time');
  const progress = q<HTMLDivElement>('.progress-fill');
  const wisps = [...app.querySelectorAll<SVGSVGElement>('svg.wisp')];
  const drawPanel = setupPanel(app);

  // Local countdown, re-synchronised by every snapshot.
  let timer = { status: 'idle', remainingMs: 0, totalMs: 0, endsAt: 0 };

  const drawTime = () => {
    const idle = timer.status === 'idle';
    const remaining =
      timer.status === 'running'
        ? Math.max(0, timer.endsAt - performance.now())
        : timer.remainingMs;
    minutes.textContent = idle ? it.island.noTimer : String(Math.ceil(remaining / 60_000));
    time.textContent = idle ? it.island.noTime : formatTime(remaining);
    const elapsed = timer.totalMs > 0 ? 1 - remaining / timer.totalMs : 0;
    progress.style.width = `${Math.min(100, Math.max(0, elapsed * 100))}%`;
  };

  const show = (snapshot: Snapshot) => {
    for (const svg of wisps) {
      applyState(svg, snapshot.state, palette);
    }
    mini.classList.toggle('attention', looks[snapshot.state].attention);
    barTimer.classList.toggle('paused', snapshot.timer.status === 'paused');
    timer = {
      status: snapshot.timer.status,
      remainingMs: snapshot.timer.remaining_ms,
      totalMs: snapshot.timer.total_ms,
      endsAt: performance.now() + snapshot.timer.remaining_ms,
    };
    drawPanel(snapshot);
    drawTime();
  };

  // Draw Wisp right away, then ask the backend for the real snapshot.
  for (const svg of wisps) {
    applyState(svg, 'focused', palette);
  }
  void invoke<Snapshot>('current_snapshot').then(show);
  void listen<Snapshot>('wisp://state', (event) => show(event.payload));
  void listen<{ open: boolean }>('wisp://island', (event) => {
    island.classList.toggle('open', event.payload.open);
  });

  window.setInterval(drawTime, 250);
  scheduleBlinks(wisps);
}

/** 1:05:09 for long timers, 24:59 otherwise. */
function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
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
