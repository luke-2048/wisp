import { describe, expect, it } from 'vitest';
import { palettes, toRgb } from './colors';
import { frame, type Pose } from './geometry';
import { stateExpression, WISP_STATES, type Expression } from './params';

function pose(face: Expression, overrides: Partial<Pose> = {}): Pose {
  return {
    face,
    look: { x: 0, y: 0 },
    squash: { x: 1, y: 1 },
    armLag: { x: 0, y: 0 },
    tail: 0,
    blink: 0,
    bob: 0,
    wave: 0,
    lift: 0,
    color: toRgb(palettes.lilla.base),
    turn: 1,
    ...overrides,
  };
}

/** Walks the whole frame: every number finite, no "NaN" or "Infinity" in any path. */
function expectFinite(value: unknown, path = 'frame'): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), path).toBe(true);
  } else if (typeof value === 'string') {
    expect(value, path).not.toMatch(/NaN|Infinity/);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) expectFinite(child, `${path}.${key}`);
  }
}

describe('geometry', () => {
  for (const state of WISP_STATES) {
    it(`draws ${state} without NaN or Infinity`, () => {
      expectFinite(frame(pose(stateExpression(state)), palettes.lilla));
    });
  }

  it('survives extreme parameters', () => {
    for (const extreme of [-3, -1, 0, 0.5, 1, 3]) {
      const face = stateExpression('focused');
      for (const key of Object.keys(face) as (keyof Expression)[]) face[key] = extreme;
      for (const look of [-1, 0, 1]) {
        const extremePose = pose(face, {
          look: { x: look, y: -look },
          squash: { x: 1 + extreme / 10, y: 1 - extreme / 10 },
          armLag: { x: extreme * 2, y: -extreme * 2 },
          tail: extreme * 3,
          blink: extreme > 0 ? 1 : 0,
          bob: extreme,
          wave: extreme * 12,
          lift: extreme * 200,
          color: [extreme * 300, 0, 255],
          turn: 1.5,
        });
        for (const palette of Object.values(palettes)) expectFinite(frame(extremePose, palette));
      }
    }
  });

  it('turns the face towards the gaze and the light the other way', () => {
    const still = frame(pose(stateExpression('focused')), palettes.lilla);
    const right = frame(pose(stateExpression('focused'), { look: { x: 1, y: 0 } }), palettes.lilla);
    expect(right.cheeks.left.x).toBeGreaterThan(still.cheeks.left.x);
    expect(right.highlights[0].x).toBeLessThan(still.highlights[0].x);
  });
});
