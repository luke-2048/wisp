import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createWisp } from '../character';
import { palettes, type PaletteName } from '../character/colors';
import { ATTENTION, type WispState } from '../character/params';
import { it } from '../i18n/it';
import './island.css';
import { panelHtml, setupPanel } from './panel';
import type { Snapshot } from './snapshot';
import { playDone, playTimerEnd } from './sounds';

// The island draws what the backend tells it:
// - `wisp://island` opens or closes it (Rust watches the cursor);
// - `wisp://state` carries Wisp's state, the task and the timer;
// - `wisp://cursor` is where the mouse is, anywhere on screen, so Wisp can
//   look at you even when you are far from the island.
// Between two snapshots the countdown runs on the local clock, only to keep
// the numbers moving; when the timer ends is decided in Rust.
// The palette comes from the settings, inside every snapshot.
let palette = palettes.lilla;

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `
    <div class="island" style="--palette-base:${palette.base}">
      <div class="shape">
        <div class="bar">
          <span class="mini"></span>
          <span class="timer">
            <span class="dot"></span>
            <span class="minutes">${it.island.noTimer}</span>
          </span>
        </div>
        <div class="panel">
          <div class="full"></div>
          ${panelHtml()}
        </div>
      </div>
    </div>`;

  const q = <T extends Element>(selector: string) => app.querySelector<T>(selector)!;
  const island = q<HTMLDivElement>('.island');
  const barTimer = q<HTMLSpanElement>('.timer');
  const minutes = q<HTMLSpanElement>('.minutes');
  const time = q<HTMLDivElement>('.time');
  const progress = q<HTMLDivElement>('.progress-fill');
  const panel = setupPanel(app);

  // Two Wisps: the tiny one in the closed bar only looks around (the closed
  // bar lets clicks through); the big one in the panel can be clicked,
  // pulled like an elastic and petted.
  const mini = createWisp(q<HTMLSpanElement>('.mini'), {
    palette: 'lilla',
    size: 24,
    mode: 'island',
    compact: true,
    interactive: false,
  });
  const full = createWisp(q<HTMLDivElement>('.full'), {
    palette: 'lilla',
    size: 150,
    mode: 'island',
    area: q<HTMLDivElement>('.panel'),
  });
  const wisps = [mini, full];

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

  let previous: WispState | null = null;

  const show = (snapshot: Snapshot) => {
    const name: PaletteName = snapshot.settings.palette;
    palette = palettes[name];
    island.style.setProperty('--palette-base', palette.base);
    for (const wisp of wisps) {
      wisp.setPalette(name);
      wisp.setState(snapshot.state);
    }
    // 'none' | 'soft' | 'alert': island.css makes the closed bar call you.
    island.dataset.attention = ATTENTION[snapshot.state];

    // A sound only when the state changes, never for the first snapshot.
    if (previous !== null && previous !== snapshot.state) {
      if (snapshot.state === 'waiting') playTimerEnd();
      if (snapshot.state === 'done') playDone();
    }
    previous = snapshot.state;

    barTimer.classList.toggle('paused', snapshot.timer.status === 'paused');
    timer = {
      status: snapshot.timer.status,
      remainingMs: snapshot.timer.remaining_ms,
      totalMs: snapshot.timer.total_ms,
      endsAt: performance.now() + snapshot.timer.remaining_ms,
    };
    panel.draw(snapshot);
    drawTime();
  };

  // Ask the backend for the real snapshot (Wisp starts as 'focused').
  void invoke<Snapshot>('current_snapshot').then(show);
  void listen<Snapshot>('wisp://state', (event) => show(event.payload));
  void listen<{ open: boolean }>('wisp://island', (event) => {
    island.classList.toggle('open', event.payload.open);
    // Next time it opens on task and timer, once the closing animation is over.
    if (!event.payload.open) window.setTimeout(() => panel.reset(), 400);
  });

  // Window coordinates, in CSS pixels: the same space as the page.
  void listen<{ x: number; y: number }>('wisp://cursor', (event) => {
    for (const wisp of wisps) wisp.setLookTarget(event.payload.x, event.payload.y);
  });

  window.setInterval(drawTime, 250);
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
