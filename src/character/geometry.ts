// Pure functions: the simulated values of one instant → SVG paths and attributes.
// No DOM, no clock, no randomness: same input, same drawing.
// Coordinates are in the SVG's 120x120 viewBox, except `shadow`, which is in
// scene units (see sim.ts: Wisp is 300 scene units wide).

import { mix, toHex, WHITE, type Palette, type Rgb } from './colors';
import type { Expression, SymbolName, Vec } from './params';

/** One instant of the simulation, as geometry needs it. */
export interface Pose {
  face: Expression;
  /** Gaze, -1..1 on both axes. */
  look: Vec;
  /** Body scale (squash and stretch), 1 = at rest. */
  squash: Vec;
  /** Arms lagging behind the body. */
  armLag: Vec;
  /** Tail tip offset. */
  tail: number;
  /** 0 eyes open … 1 closed, during a blink. */
  blink: number;
  /** Floating offset, in viewBox units. */
  bob: number;
  /** Arm waving angle in degrees, before scaling by how raised the arms are. */
  wave: number;
  /** How far above its home Wisp is, in scene units (for the ground shadow). */
  lift: number;
  color: Rgb;
  /** How much the gaze turns the face (1 = as in the reference). */
  turn: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Arm extends Point {
  angle: number;
}

export interface Eye {
  d: string;
  /** Glints only show with the eye open enough and not happy. */
  glintOpacity: number;
  glint: Point;
  sparkle: Point;
}

export interface Frame {
  colors: { highlight: string; base: string; shade: string; glow: string; rim: string };
  /** Focus of the body gradient: the light moves a little as Wisp turns. */
  gradientFx: number;
  halo: number;
  /** Vertical offset of the whole character (floating + rise). */
  offsetY: number;
  squash: string;
  bodyOpacity: number;
  body: string;
  rim: string;
  arms: { left: Arm; right: Arm };
  highlights: [Point, Point, Point];
  cheeks: { left: Point & { rx: number }; right: Point & { rx: number }; opacity: number };
  eyes: { left: Eye; right: Eye };
  mouth: { d: string; fillOpacity: number };
  symbols: Record<SymbolName, number>;
  shadow: { width: number; height: number; opacity: number };
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Two decimals are plenty for SVG and keep the attributes short. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The body with its curly tail; `t` moves the tail tip. */
export function bodyPath(t: number): string {
  return (
    `M60 26 C82 26 96 42 96 62 C96 78 88 88 78 92 ` +
    `C${r2(84 + t * 0.5)} 96 ${r2(92 + t)} 96 ${r2(98 + t)} ${r2(92 - t * 0.3)} ` +
    `C${r2(96 + t)} 102 84 106 72 100 C68 98 64 98 60 98 C40 98 24 84 24 62 C24 42 38 26 60 26 Z`
  );
}

/**
 * An eye as two cubic curves (upper and lower lid). Control points sit at the
 * ends, so the shape is round rather than almond-like.
 */
function eye(cx: number, cy: number, rx: number, open: number, happy: number, blink: number): Eye {
  const o = open >= 0 ? open * (1 - blink) : open;
  const top = o >= 0 ? 5.6 * o : o * 14;
  const bottom = top - (o >= 0 ? Math.max(0, happy) * 7.5 : 0);
  const yTop = r2(cy - (top * 4) / 3);
  const yBottom = r2(cy + (bottom * 4) / 3);
  const a = r2(cx - rx);
  const b = r2(cx + rx);
  const y = r2(cy);
  return {
    d: `M${a} ${y} C${a} ${yTop} ${b} ${yTop} ${b} ${y} C${b} ${yBottom} ${a} ${yBottom} ${a} ${y} Z`,
    glintOpacity: clamp((top - 3) / 1.5, 0, 1) * clamp(1 - happy, 0, 1),
    glint: { x: cx + rx * 0.38, y: cy - top * 0.45 },
    sparkle: { x: cx - rx * 0.35, y: cy + top * 0.35 },
  };
}

export function frame(pose: Pose, palette: Palette): Frame {
  const { face: e, squash, armLag } = pose;
  const lx = clamp(pose.look.x * pose.turn, -1.5, 1.5);
  const ly = clamp(pose.look.y * pose.turn, -1.5, 1.5);
  const away = Math.abs(lx);
  const offsetY = pose.bob + e.rise;

  // "It turns": the face slides towards the gaze, the far eye and cheek get
  // narrower (foreshortening), the highlights move the other way (the light
  // stays still in the world).
  const faceX = lx * 8;
  const faceY = ly * 5;
  const spacing = 12 * (1 - 0.15 * away);
  const centre = 59 + faceX;
  const eyeY = 64 + faceY;
  const rxLeft = 4.2 * (1 - 0.32 * Math.max(-lx, 0));
  const rxRight = 4.2 * (1 - 0.32 * Math.max(lx, 0));

  const mx = 59 + faceX * 1.05;
  const my = 72 + faceY;
  const mw = Math.max(0.8, e.mouthWidth * (1 - 0.15 * away));
  const curve = my + e.smile * 5;
  const mouthOpen = Math.max(0, e.mouthOpen);

  const arms = clamp(e.arms, -0.2, 1.2);
  const wave = pose.wave * arms;

  const height = pose.lift - offsetY * 2.5;
  const shadowScale = clamp(1 - height / 380, 0.45, 1.15);

  const base = toHex(pose.color);
  return {
    colors: {
      highlight: mix(base, WHITE, 0.65),
      base,
      shade: mix(base, palette.shadow, 0.5),
      glow: mix(base, palette.warm, 0.7),
      rim: mix(base, WHITE, 0.75),
    },
    gradientFx: r2(0.34 - lx * 0.06),
    halo: clamp(e.glow, 0, 1),
    offsetY: r2(offsetY),
    squash: `translate(60 100) scale(${r2(squash.x * (1 - 0.05 * away))} ${r2(squash.y)}) translate(-60 -100)`,
    bodyOpacity: clamp(e.opacity, 0, 1),
    body: bodyPath(pose.tail),
    rim: `translate(${r2(-3.5 - lx * 1.5)} ${r2(-3.5 - ly)})`,
    arms: {
      left: {
        x: lerp(26, 24, arms) + armLag.x - lx * 1.5,
        y: lerp(74, 50, arms) + armLag.y,
        angle: lerp(28, -30, arms) + wave,
      },
      right: {
        x: lerp(94, 96, arms) + armLag.x - lx * 1.5,
        y: lerp(74, 50, arms) + armLag.y * 0.8,
        angle: lerp(-28, 30, arms) - wave,
      },
    },
    highlights: [
      { x: 45 - lx * 4, y: 41 - ly * 3 },
      { x: 41 - lx * 4.8, y: 38 - ly * 3.6 },
      { x: 50 - lx * 4.4, y: 33 - ly * 3.3 },
    ],
    cheeks: {
      left: {
        x: centre - 22 * (1 - 0.1 * away),
        y: 73 + faceY,
        rx: 6 * (1 - 0.45 * Math.max(-lx, 0)),
      },
      right: {
        x: centre + 22 * (1 - 0.1 * away),
        y: 73 + faceY,
        rx: 6 * (1 - 0.45 * Math.max(lx, 0)),
      },
      opacity: clamp(e.blush, 0, 1.4) * 0.6,
    },
    eyes: {
      left: eye(centre - spacing, eyeY, rxLeft, e.open + e.wink, e.happy, pose.blink),
      right: eye(centre + spacing, eyeY, rxRight, e.open, e.happy, pose.blink),
    },
    mouth: {
      d:
        `M${r2(mx - mw)} ${r2(my)} Q${r2(mx)} ${r2(curve)} ${r2(mx + mw)} ${r2(my)} ` +
        `Q${r2(mx)} ${r2(curve + mouthOpen * 9)} ${r2(mx - mw)} ${r2(my)} Z`,
      // The fill appears only when the mouth is open.
      fillOpacity: clamp(mouthOpen * 5, 0, 1),
    },
    symbols: {
      question: clamp(e.question, 0, 1),
      sweat: clamp(e.sweat, 0, 1),
      bang: clamp(e.bang, 0, 1),
      spark: clamp(e.spark, 0, 1),
      zzz: clamp(e.zzz, 0, 1),
    },
    shadow: {
      width: 130 * shadowScale * squash.x,
      height: 24 * shadowScale,
      opacity: 0.95 * shadowScale,
    },
  };
}
