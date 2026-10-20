// The pointer: nearby, click, drag, caress. The first half is pure (it only
// changes `sim.input` and pushes springs), so it can be tested; the second half
// connects it to real pointer events.

import type { Vec } from './params';
import type { Sim } from './sim';

/** Movement (scene units) after which a press becomes a drag. */
const DRAG_START = 8;
/** How close (scene units) the pointer must be for its movement to count as petting. */
const PET_RADIUS = 115;

export function pointerMove(sim: Sim, p: Vec): void {
  const input = sim.input;
  input.pointer = p;
  input.lastMove = sim.time;
  const at = sim.offset();
  if (
    input.pressed &&
    !input.dragging &&
    Math.hypot(p.x - input.down.x, p.y - input.down.y) > DRAG_START
  ) {
    input.dragging = true;
    input.grab = { x: input.down.x - at.x, y: input.down.y - at.y };
  }
  // A caress: horizontal movement over Wisp adds up (and decays in sim.tick).
  if (!input.pressed && Math.hypot(p.x - at.x, p.y - at.y) < PET_RADIUS) {
    input.petting += Math.abs(p.x - input.previousX);
  }
  input.previousX = p.x;
}

export function pointerDown(sim: Sim, p: Vec): void {
  const input = sim.input;
  input.pointer = p;
  input.lastMove = sim.time;
  input.down = p;
  input.pressed = true;
  input.dragging = false;
}

/** Let go: a click bounces and giggles, a drag just giggles while it springs back. */
export function pointerUp(sim: Sim): void {
  const input = sim.input;
  if (!input.pressed) return;
  const wasDrag = input.dragging;
  input.pressed = false;
  input.dragging = false;
  if (wasDrag) sim.react('giggle', 0.7);
  else sim.bounce();
}

/** The pointer left the area. `forget`: Wisp stops looking at where it was. */
export function pointerLeave(sim: Sim, forget: boolean): void {
  pointerUp(sim);
  if (forget) sim.input.pointer = null;
}

export interface PointerBinding {
  /** Where moving counts (petting, being near). Must contain `target`: captured
   * events bubble up to it while dragging. */
  area: HTMLElement;
  /** What can be grabbed: Wisp's SVG. */
  target: Element;
  /** Page pixels → scene units around Wisp's home. */
  toScene(clientX: number, clientY: number): Vec;
  /** Free mode forgets the pointer when it leaves; the island keeps following the global cursor. */
  forgetOnLeave: boolean;
}

/** Connects real pointer events; returns a function that disconnects them. */
export function attachPointer(sim: Sim, binding: PointerBinding): () => void {
  const { area, target, toScene } = binding;
  const at = (event: PointerEvent) => toScene(event.clientX, event.clientY);
  const cursor = () => {
    (target as SVGElement).style.cursor = sim.input.pressed ? 'grabbing' : 'grab';
  };

  const onMove = (event: PointerEvent) => pointerMove(sim, at(event));
  const onDown = (event: PointerEvent) => {
    pointerDown(sim, at(event));
    // Keep receiving the movement even outside the area while held.
    target.setPointerCapture(event.pointerId);
    event.preventDefault();
    cursor();
  };
  const onUp = () => {
    pointerUp(sim);
    cursor();
  };
  const onLeave = () => {
    if (sim.input.pressed) return; // captured: the drag goes on
    pointerLeave(sim, binding.forgetOnLeave);
  };

  area.addEventListener('pointermove', onMove);
  area.addEventListener('pointerleave', onLeave);
  target.addEventListener('pointerdown', onDown as EventListener);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onUp);
  cursor();

  return () => {
    area.removeEventListener('pointermove', onMove);
    area.removeEventListener('pointerleave', onLeave);
    target.removeEventListener('pointerdown', onDown as EventListener);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onUp);
  };
}
