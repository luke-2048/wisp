// What Wisp should look like, as numbers. Values from docs/wisp-reference.html.
// Each state is a set of TARGETS for continuous parameters; springs chase them,
// so going from one state to another is always smooth.

import type { Palette } from './colors';
import type { SpringConfig } from './spring';

export type WispState = 'focused' | 'distracted' | 'break' | 'waiting' | 'done' | 'night';

export const WISP_STATES: readonly WispState[] = [
  'focused',
  'distracted',
  'break',
  'waiting',
  'done',
  'night',
];

/** The face and pose parameters. */
export interface Face {
  /** Eye opening: 1 normal, >1 wide open, ~0 a line (blink), <0 closed like ∪. */
  open: number;
  /** 0..1: the lower eyelid rises and the eyes become ∩. */
  happy: number;
  /** Mouth curve: -1 sad … 1 smile. */
  smile: number;
  /** Mouth opening 0..1. */
  mouthOpen: number;
  /** Half the mouth width. */
  mouthWidth: number;
  /** Cheeks intensity. */
  blush: number;
  /** Body opacity (the face always stays visible). */
  opacity: number;
  /** Arms: 0 down … 1 raised. */
  arms: number;
  /** Vertical offset, positive is down. */
  rise: number;
  /** Golden halo behind. */
  glow: number;
  /** Extra opening of the left eye only: night peeks with one eye. */
  wink: number;
}

export type SymbolName = 'question' | 'sweat' | 'bang' | 'spark' | 'zzz';
export const SYMBOLS: readonly SymbolName[] = ['question', 'sweat', 'bang', 'spark', 'zzz'];

/** Everything the expression springs animate: face plus symbol opacities. */
export type Expression = Face & Record<SymbolName, number>;

/** Which palette colour the body is made of. */
export type Tone = keyof Pick<Palette, 'base' | 'light' | 'dim' | 'night'>;

export interface Vec {
  x: number;
  y: number;
}

export interface StateLook {
  tone: Tone;
  symbol: SymbolName | null;
  /** A fixed gaze (distracted looks away), or null to look around freely. */
  look: Vec | null;
  face: Face;
}

const face = (f: Omit<Face, 'wink'>): Face => ({ ...f, wink: 0 });

export const STATES: Record<WispState, StateLook> = {
  focused: {
    tone: 'base',
    symbol: null,
    look: null,
    face: face({
      open: 1,
      happy: 0,
      smile: 0.35,
      mouthOpen: 0,
      mouthWidth: 3.6,
      blush: 0.6,
      opacity: 1,
      arms: 0,
      rise: 0,
      glow: 0,
    }),
  },
  distracted: {
    tone: 'base',
    symbol: 'question',
    look: { x: 0.95, y: -0.35 },
    face: face({
      open: 0.95,
      happy: 0,
      smile: -0.25,
      mouthOpen: 0,
      mouthWidth: 4,
      blush: 0,
      opacity: 0.4,
      arms: 0,
      rise: 0,
      glow: 0,
    }),
  },
  break: {
    tone: 'dim',
    symbol: 'sweat',
    look: null,
    face: face({
      open: 0.32,
      happy: 0,
      smile: -0.1,
      mouthOpen: 0,
      mouthWidth: 3,
      blush: 0,
      opacity: 0.92,
      arms: 0,
      rise: 3,
      glow: 0,
    }),
  },
  waiting: {
    tone: 'base',
    symbol: 'bang',
    look: null,
    face: face({
      open: 1.22,
      happy: 0,
      smile: 0,
      mouthOpen: 0.6,
      mouthWidth: 2.6,
      blush: 0.6,
      opacity: 1,
      arms: 1,
      rise: -6,
      glow: 0,
    }),
  },
  done: {
    tone: 'light',
    symbol: 'spark',
    look: null,
    face: face({
      open: 0.8,
      happy: 1,
      smile: 1,
      mouthOpen: 0.6,
      mouthWidth: 5,
      blush: 0.7,
      opacity: 1,
      arms: 1,
      rise: -4,
      glow: 0.55,
    }),
  },
  night: {
    tone: 'night',
    symbol: 'zzz',
    look: null,
    face: face({
      open: -0.15,
      happy: 0,
      smile: 0.15,
      mouthOpen: 0.3,
      mouthWidth: 1.5,
      blush: 0.35,
      opacity: 0.95,
      arms: 0,
      rise: 5,
      glow: 0,
    }),
  },
};

/** Reactions to the user: they temporarily replace the state's targets. */
export type Reaction = 'squish' | 'giggle' | 'whee' | 'love';

export const REACTIONS: Record<Reaction, Face> = {
  // held down
  squish: face({
    open: 0.2,
    happy: 0.7,
    smile: 0.5,
    mouthOpen: 0.1,
    mouthWidth: 3,
    blush: 1.1,
    opacity: 1,
    arms: 0.15,
    rise: 2,
    glow: 0,
  }),
  // released
  giggle: face({
    open: 0.85,
    happy: 1,
    smile: 1,
    mouthOpen: 0.55,
    mouthWidth: 4.6,
    blush: 1.1,
    opacity: 1,
    arms: 0.7,
    rise: -3,
    glow: 0.25,
  }),
  // dragged
  whee: face({
    open: 1.3,
    happy: 0,
    smile: 0.2,
    mouthOpen: 0.85,
    mouthWidth: 2.6,
    blush: 0.7,
    opacity: 1,
    arms: 1,
    rise: 0,
    glow: 0,
  }),
  // petted
  love: face({
    open: 0.7,
    happy: 1,
    smile: 0.9,
    mouthOpen: 0.15,
    mouthWidth: 4,
    blush: 1.4,
    opacity: 1,
    arms: 0.35,
    rise: -2,
    glow: 0.35,
  }),
};

/** Stiffness and damping of every spring; the playground edits them live. */
export interface Tuning {
  expression: SpringConfig;
  look: SpringConfig;
  home: SpringConfig;
  drag: SpringConfig;
  squash: SpringConfig;
  tail: SpringConfig;
  arms: SpringConfig;
  /** How much the gaze "turns" the face (1 = as in the reference). */
  turn: number;
}

export const DEFAULT_TUNING: Tuning = {
  expression: { k: 150, c: 20 },
  look: { k: 70, c: 12 },
  home: { k: 75, c: 9 },
  drag: { k: 320, c: 30 },
  squash: { k: 420, c: 11 },
  tail: { k: 90, c: 8 },
  arms: { k: 80, c: 7 },
  turn: 1,
};

/** The full expression (face plus symbols) a state asks for. */
export function stateExpression(state: WispState): Expression {
  const look = STATES[state];
  const symbols = Object.fromEntries(
    SYMBOLS.map((name) => [name, look.symbol === name ? 1 : 0]),
  ) as Record<SymbolName, number>;
  return { ...look.face, ...symbols };
}
