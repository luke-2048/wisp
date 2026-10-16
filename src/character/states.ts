// How Wisp looks in each state (the table in docs/WISP_windows_v0.1.md).
// The backend decides the state; this file only says how to draw it.

import type { Palette } from './colors';

export type WispState = 'focused' | 'distracted' | 'break' | 'waiting' | 'done' | 'night';

export type Eyes = 'dot' | 'side' | 'wide' | 'tired' | 'happy' | 'closed';
export type Mouth = 'calm' | 'wavy' | 'flat' | 'o' | 'grin' | 'sleep';
export type Arms = 'down' | 'up';

export interface Look {
  eyes: Eyes;
  mouth: Mouth;
  arms: Arms;
  /** Which palette colour the body is made of. */
  color: keyof Pick<Palette, 'base' | 'light' | 'dim' | 'night'>;
  /** Only the body fades: the face always stays visible. */
  bodyOpacity: number;
  /** CSS transform of the whole character, around the bottom of the body. */
  pose: string;
  /** Wisp has something to tell you: the mini Wisp in the bar glows. */
  attention: boolean;
}

export const looks: Record<WispState, Look> = {
  focused: {
    eyes: 'dot',
    mouth: 'calm',
    arms: 'down',
    color: 'base',
    bodyOpacity: 1,
    pose: 'none',
    attention: false,
  },
  distracted: {
    eyes: 'side',
    mouth: 'wavy',
    arms: 'down',
    color: 'base',
    bodyOpacity: 0.4,
    pose: 'rotate(-8deg)',
    attention: false,
  },
  break: {
    eyes: 'tired',
    mouth: 'flat',
    arms: 'down',
    color: 'dim',
    bodyOpacity: 0.92,
    pose: 'scale(1.06, 0.92)',
    attention: true,
  },
  waiting: {
    eyes: 'wide',
    mouth: 'o',
    arms: 'up',
    color: 'base',
    bodyOpacity: 1,
    pose: 'translateY(-6px)',
    attention: true,
  },
  done: {
    eyes: 'happy',
    mouth: 'grin',
    arms: 'up',
    color: 'light',
    bodyOpacity: 1,
    pose: 'translateY(-4px)',
    attention: true,
  },
  night: {
    eyes: 'closed',
    mouth: 'sleep',
    arms: 'down',
    color: 'night',
    bodyOpacity: 0.95,
    pose: 'translateY(5px)',
    attention: false,
  },
};
