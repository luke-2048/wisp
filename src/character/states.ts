// How Wisp looks in each state (the table in docs/WISP_windows_v0.1.md).
// The backend decides the state; this file only says how to draw it.

import type { Palette } from './colors';

export type WispState = 'focused' | 'distracted' | 'break' | 'waiting' | 'done' | 'night';

export type Eyes = 'dot' | 'side' | 'wide' | 'tired' | 'happy' | 'closed';
export type Mouth = 'calm' | 'wavy' | 'flat' | 'o' | 'grin' | 'sleep';
export type Arms = 'down' | 'up';

/**
 * How the mini Wisp in the closed bar calls you:
 * - 'soft': a slow lilac glow (break, done);
 * - 'alert': a red blink, only when the timer has ended (owner's choice: the
 *   mini Wisp is small, a soft glow is easy to miss).
 */
export type Attention = 'none' | 'soft' | 'alert';

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
  attention: Attention;
}

export const looks: Record<WispState, Look> = {
  focused: {
    eyes: 'dot',
    mouth: 'calm',
    arms: 'down',
    color: 'base',
    bodyOpacity: 1,
    pose: 'none',
    attention: 'none',
  },
  distracted: {
    eyes: 'side',
    mouth: 'wavy',
    arms: 'down',
    color: 'base',
    bodyOpacity: 0.4,
    pose: 'rotate(-8deg)',
    attention: 'none',
  },
  break: {
    eyes: 'tired',
    mouth: 'flat',
    arms: 'down',
    color: 'dim',
    bodyOpacity: 0.92,
    pose: 'scale(1.06, 0.92)',
    attention: 'soft',
  },
  waiting: {
    eyes: 'wide',
    mouth: 'o',
    arms: 'up',
    color: 'base',
    bodyOpacity: 1,
    pose: 'translateY(-6px)',
    attention: 'alert',
  },
  done: {
    eyes: 'happy',
    mouth: 'grin',
    arms: 'up',
    color: 'light',
    bodyOpacity: 1,
    pose: 'translateY(-4px)',
    attention: 'soft',
  },
  night: {
    eyes: 'closed',
    mouth: 'sleep',
    arms: 'down',
    color: 'night',
    bodyOpacity: 0.95,
    pose: 'translateY(5px)',
    attention: 'none',
  },
};
