// Wisp's public API: everything else in src/character is an implementation detail.
//
//   const wisp = createWisp(container, { palette: 'lilla', size: 150, mode: 'island' });
//   wisp.setState('done');

import { palettes, type PaletteName } from './colors';
import { frame } from './geometry';
import { startLoop } from './loop';
import type { WispState } from './params';
import { createRenderer } from './render';
import { Sim, type WispMode } from './sim';

export type { PaletteName } from './colors';
export type { WispState } from './params';
export type { WispMode } from './sim';

export interface WispOptions {
  palette: PaletteName;
  /** Width and height in CSS pixels. */
  size: number;
  /** 'free': drag it anywhere in `area`. 'island': an elastic that pulls down ~40 px. */
  mode: WispMode;
  /** Small icon framing (closed bar): tight, no shadow, no symbols. */
  compact?: boolean;
  /** Initial state, so the first frame is already right. */
  state?: WispState;
}

export interface Wisp {
  setState(state: WispState): void;
  setPalette(palette: PaletteName): void;
  /** Something to look at, in page (client) coordinates. */
  setLookTarget(x: number, y: number): void;
  /** Like a click: for keyboard and tests. */
  poke(): void;
  destroy(): void;
  /** The simulation, for the playground's sliders. */
  readonly sim: Sim;
}

/** How far the island's elastic stretches, in CSS pixels. */
const ELASTIC_PX = 40;

let count = 0;
const nextId = () => `wisp-${++count}`;

export function createWisp(container: HTMLElement, options: WispOptions): Wisp {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sim = new Sim({
    mode: options.mode,
    state: options.state,
    palette: palettes[options.palette],
    reducedMotion: motion.matches,
  });
  const renderer = createRenderer({
    id: nextId(),
    compact: options.compact ?? false,
    size: options.size,
  });
  sim.elastic = ELASTIC_PX / renderer.pixelsPerUnit();
  container.append(renderer.root);

  const onMotionChange = () => (sim.reducedMotion = motion.matches);
  motion.addEventListener('change', onMotionChange);

  const draw = () => renderer.draw(frame(sim.pose(), sim.palette), sim.offset());
  draw();
  const loop = startLoop((dt) => {
    sim.tick(dt);
    draw();
  });

  return {
    sim,
    setState(state) {
      sim.state = state;
    },
    setPalette(palette) {
      sim.palette = palettes[palette];
    },
    setLookTarget(x, y) {
      // Page pixels → scene units around Wisp's home (the centre of its box).
      const box = renderer.root.getBoundingClientRect();
      const u = renderer.pixelsPerUnit();
      sim.input.pointer = {
        x: (x - box.left - box.width / 2) / u,
        y: (y - box.top - box.height / 2) / u,
      };
      sim.input.lastMove = sim.time;
    },
    poke() {
      sim.bounce();
    },
    destroy() {
      loop.stop();
      motion.removeEventListener('change', onMotionChange);
      renderer.root.remove();
    },
  };
}

/** A Wisp that doesn't move: one frame, no loop. For icons and colour swatches. */
export function renderStill(
  container: HTMLElement,
  options: { palette: PaletteName; size: number; state?: WispState; compact?: boolean },
): void {
  const sim = new Sim({
    mode: 'island',
    state: options.state,
    palette: palettes[options.palette],
    reducedMotion: true,
  });
  const renderer = createRenderer({
    id: nextId(),
    compact: options.compact ?? true,
    size: options.size,
  });
  container.replaceChildren(renderer.root);
  renderer.draw(frame(sim.pose(), sim.palette), sim.offset());
}
