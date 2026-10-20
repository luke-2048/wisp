// The simulation: every frame it decides the targets (state → mouse → reaction)
// and moves each spring a little towards them. No DOM here: time comes in as
// `dt`, randomness through `random`, the pointer through `input`.
//
// Units: "scene units", where Wisp's 120x120 viewBox is 300 units wide (as in
// docs/wisp-reference.html). Positions are relative to Wisp's home, y down.

import { palettes, toRgb, type Palette, type Rgb } from './colors';
import type { Pose } from './geometry';
import {
  DEFAULT_TUNING,
  REACTIONS,
  STATES,
  SYMBOLS,
  stateExpression,
  type Expression,
  type Reaction,
  type Tuning,
  type Vec,
  type WispState,
} from './params';
import { follow, type Spring } from './spring';

export type WispMode = 'free' | 'island';

/** What the pointer is doing, written by input.ts (or by `lookAt`). */
export interface InputState {
  /** Last known pointer position, or null if we never saw it. */
  pointer: Vec | null;
  /** Sim time of the last pointer movement. */
  lastMove: number;
  pressed: boolean;
  dragging: boolean;
  /** Where Wisp was grabbed, relative to its centre. */
  grab: Vec;
  /** Horizontal movement over Wisp, decaying: enough of it is a caress. */
  petting: number;
}

/** In free mode Wisp can be dragged inside these limits (scene units from home). */
export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SimOptions {
  mode: WispMode;
  state?: WispState;
  palette?: Palette;
  reducedMotion?: boolean;
  /** 0..1, like Math.random; tests pass a fixed one. */
  random?: () => number;
  bounds?: Bounds;
  /** Island mode: how far Wisp can be pulled down, in scene units. */
  elastic?: number;
}

const spring = (value: number): Spring => ({ value, velocity: 0 });
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Resistance that grows with the pull: never more than `max`. */
function rubber(distance: number, max: number): number {
  if (max <= 0) return 0;
  return Math.sign(distance) * max * (1 - Math.exp(-Math.abs(distance) / max));
}

/** How close the pointer must be (scene units) for Wisp to notice it. */
const NEAR = 190;
/** Accumulated horizontal movement that counts as a caress. */
const PET_THRESHOLD = 900;

export class Sim {
  readonly mode: WispMode;
  state: WispState;
  palette: Palette;
  tuning: Tuning = { ...DEFAULT_TUNING };
  reducedMotion: boolean;
  bounds: Bounds;
  elastic: number;
  readonly input: InputState = {
    pointer: null,
    lastMove: -10,
    pressed: false,
    dragging: false,
    grab: { x: 0, y: 0 },
    petting: 0,
  };

  time = 0;
  private readonly random: () => number;
  private readonly face: Record<keyof Expression, Spring>;
  private readonly position = { x: spring(0), y: spring(0) };
  private readonly squash = { x: spring(1), y: spring(1) };
  private readonly look = { x: spring(0), y: spring(0) };
  private readonly armLag = { x: spring(0), y: spring(0) };
  private readonly tail = spring(0);
  private color: Rgb;
  private reaction: Reaction | null = null;
  private reactionUntil = 0;
  /** The reaction shown in the current frame (holding counts as one too). */
  private shown: Reaction | null = null;
  private blink = 0;
  private blinkAt = 2;
  private blinkTime = -1;
  private idleLook: Vec = { x: 0, y: 0 };
  private idleNext = 0;
  private nextHop = 1;

  constructor(options: SimOptions) {
    this.mode = options.mode;
    this.state = options.state ?? 'focused';
    this.palette = options.palette ?? palettes.lilla;
    this.reducedMotion = options.reducedMotion ?? false;
    this.random = options.random ?? Math.random;
    this.bounds = options.bounds ?? { left: 0, right: 0, top: 0, bottom: 0 };
    this.elastic = options.elastic ?? 0;
    // Start already in the state's pose, so the first frame is not a transition.
    const start = stateExpression(this.state);
    this.face = Object.fromEntries(
      Object.entries(start).map(([key, value]) => [key, spring(value)]),
    ) as Record<keyof Expression, Spring>;
    this.color = toRgb(this.palette[STATES[this.state].tone]);
  }

  /** Current value of every expression parameter. */
  expression(): Expression {
    const values = {} as Expression;
    for (const key of Object.keys(this.face) as (keyof Expression)[]) {
      values[key] = this.face[key].value;
    }
    return values;
  }

  /** Starts a reaction (giggle, love…) for `seconds`. */
  react(reaction: Reaction, seconds: number): void {
    this.reaction = reaction;
    this.reactionUntil = this.time + seconds;
  }

  /** A push to the springs: velocity for the position and for the squash. */
  kick(velocity: Vec, squash: Vec = { x: 0, y: 0 }): void {
    this.position.x.velocity += velocity.x;
    this.position.y.velocity += velocity.y;
    this.squash.x.velocity += squash.x;
    this.squash.y.velocity += squash.y;
  }

  /** A click: bounce (push the squash spring, small hop) and giggle. */
  bounce(): void {
    this.react('giggle', 0.9);
    this.kick({ x: 0, y: -260 }, { x: -3.5, y: 5.5 });
  }

  /** Where Wisp is, relative to its home. */
  offset(): Vec {
    return { x: this.position.x.value, y: this.position.y.value };
  }

  tick(dt: number): void {
    const look = STATES[this.state];
    const tuning = this.tuning;
    const input = this.input;
    this.time += dt;
    const t = this.time;

    if (this.reaction && t > this.reactionUntil) this.reaction = null;
    const reaction: Reaction | null = input.pressed
      ? input.dragging
        ? 'whee'
        : 'squish'
      : this.reaction;
    this.shown = reaction;

    const px = this.position.x.value;
    const py = this.position.y.value;
    const dx = input.pointer ? input.pointer.x - px : 0;
    const dy = input.pointer ? input.pointer.y - py : 0;
    const sinceMove = t - input.lastMove;
    const near = input.pointer !== null && Math.hypot(dx, dy) < NEAR && sinceMove < 4;
    input.petting *= Math.exp(-dt * 1.5);
    if (input.petting > PET_THRESHOLD) {
      this.react('love', 1.8);
      input.petting = 0;
    }

    // 1. Expression targets: state → pointer nearby → reaction.
    const target = stateExpression(this.state);
    if (near && !reaction) {
      if (this.state === 'night') {
        target.wink = 0.4; // peeks with one eye
        target.zzz = 0.5;
      } else {
        target.open += 0.08;
        target.rise -= 2;
        target.arms = Math.max(target.arms, 0.25);
        target.blush = Math.max(target.blush, 0.7);
      }
      if (this.state === 'distracted') target.opacity = 0.7;
    }
    if (reaction) {
      Object.assign(target, REACTIONS[reaction]);
      for (const name of SYMBOLS) target[name] = 0;
      if (reaction === 'love') target.spark = 0.6;
    }
    for (const key of Object.keys(this.face) as (keyof Expression)[]) {
      follow(this.face[key], target[key], tuning.expression.k, tuning.expression.c, dt);
    }

    // 2. Gaze: where it is going, the pointer, the state, or random glances.
    let lookAt: Vec;
    if (reaction === 'whee') {
      lookAt = {
        x: clamp(this.position.x.velocity / 600, -1, 1),
        y: clamp(this.position.y.velocity / 600, -1, 1),
      };
    } else if (look.look && !near && !reaction) {
      lookAt = look.look;
    } else if (input.pointer && sinceMove < 5) {
      lookAt = { x: clamp(dx / 260, -1, 1), y: clamp(dy / 260, -1, 1) };
    } else {
      if (t > this.idleNext) {
        this.idleLook = { x: this.random() * 1.6 - 0.8, y: this.random() * 0.7 - 0.4 };
        this.idleNext = t + 1.6 + this.random() * 2.6;
        const sleepy = this.state === 'night' || this.state === 'break';
        if (!this.reducedMotion && !sleepy && this.random() < 0.25) {
          this.position.y.velocity -= 200; // a little hop
        }
      }
      lookAt = this.idleLook;
    }
    if (this.state === 'night' && !reaction) lookAt = { x: lookAt.x * 0.3, y: 0.2 };
    follow(this.look.x, lookAt.x, tuning.look.k, tuning.look.c, dt);
    follow(this.look.y, lookAt.y, tuning.look.k, tuning.look.c, dt);

    // 3. Position: at home (soft spring, wobbles) or dragged (stiff spring).
    if (this.state === 'waiting' && !reaction && !this.reducedMotion && t > this.nextHop) {
      this.position.y.velocity -= 170; // calls you
      this.nextHop = t + 1.6;
    }
    let home: Vec = { x: 0, y: 0 };
    if (input.dragging && input.pointer) {
      const pulled = { x: input.pointer.x - input.grab.x, y: input.pointer.y - input.grab.y };
      home =
        this.mode === 'free'
          ? {
              x: clamp(pulled.x, this.bounds.left, this.bounds.right),
              y: clamp(pulled.y, this.bounds.top, this.bounds.bottom),
            }
          : {
              // An elastic: mostly down, a little sideways, almost nothing up.
              x: rubber(pulled.x, this.elastic * 0.25),
              y:
                pulled.y > 0
                  ? rubber(pulled.y, this.elastic)
                  : rubber(pulled.y, this.elastic * 0.1),
            };
    }
    const move = input.dragging ? tuning.drag : tuning.home;
    follow(this.position.x, home.x, move.k, move.c, dt);
    follow(this.position.y, home.y, move.k, move.c, dt);

    // 4. Squash and stretch, also from speed.
    let sx = 1;
    let sy = 1;
    if (input.pressed && !input.dragging) {
      sx = 1.22;
      sy = 0.76;
    }
    if (this.state === 'break' && !reaction) {
      sx *= 1.06;
      sy *= 0.92;
    }
    const vx = this.position.x.velocity;
    const vy = this.position.y.velocity;
    const stretch = Math.min(Math.hypot(vx, vy) / 2600, 0.2);
    if (Math.abs(vy) > Math.abs(vx)) {
      sy += stretch;
      sx -= stretch * 0.6;
    } else {
      sx += stretch;
      sy -= stretch * 0.6;
    }
    follow(this.squash.x, sx, tuning.squash.k, tuning.squash.c, dt);
    follow(this.squash.y, sy, tuning.squash.k, tuning.squash.c, dt);

    // 5. Follow-through: tail and arms arrive late.
    const tailTarget = clamp(-vx / 110, -9, 9) + Math.sin(t * 2.1) * 1.4 - this.look.x.value * 2.5;
    follow(this.tail, tailTarget, tuning.tail.k, tuning.tail.c, dt);
    follow(this.armLag.x, clamp(-vx / 220, -5, 5), tuning.arms.k, tuning.arms.c, dt);
    follow(
      this.armLag.y,
      clamp(-vy / 160, -6, 6) + Math.sin(t * 2.6) * 0.8,
      tuning.arms.k,
      tuning.arms.c,
      dt,
    );

    // 6. Random blinks, every 2.5-6 s.
    if (this.blinkTime < 0 && t > this.blinkAt) this.blinkTime = 0;
    this.blink = 0;
    if (this.blinkTime >= 0) {
      this.blinkTime += dt;
      if (this.blinkTime > 0.16) {
        this.blinkTime = -1;
        this.blinkAt = t + 2.5 + this.random() * 3.5;
      } else {
        this.blink = Math.sin((Math.PI * this.blinkTime) / 0.16);
      }
    }
    if (this.reducedMotion) this.blink = 0;

    // 7. The colour fades towards the state's one.
    const tone = reaction === 'giggle' || reaction === 'love' ? 'light' : look.tone;
    const goal = toRgb(this.palette[tone]);
    const rate = Math.min(1, dt * 6);
    this.color = this.color.map((c, i) => c + (goal[i] - c) * rate) as Rgb;
  }

  /** The current instant, ready for geometry.ts. */
  pose(): Pose {
    const night = this.state === 'night';
    const still = this.reducedMotion;
    const bob = still
      ? 0
      : Math.sin((this.time * Math.PI * 2) / (night ? 4.5 : 3.2)) * (night ? 1.5 : 3);
    const waving = this.state === 'done' && !this.shown && !still;
    return {
      face: this.expression(),
      look: { x: this.look.x.value, y: this.look.y.value },
      squash: { x: this.squash.x.value, y: this.squash.y.value },
      armLag: { x: this.armLag.x.value, y: this.armLag.y.value },
      tail: this.tail.value,
      blink: this.blink,
      bob,
      wave: waving ? Math.sin(this.time * 9) * 12 : 0,
      lift: -this.position.y.value,
      color: this.color,
      turn: this.tuning.turn,
    };
  }
}
