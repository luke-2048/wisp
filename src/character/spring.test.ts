import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from './params';
import { follow, type Spring } from './spring';

// Every spring Wisp uses, at every frame length from 1 ms to 33 ms (a slow frame).
const springs = Object.entries(DEFAULT_TUNING).filter(([name]) => name !== 'turn') as [
  string,
  { k: number; c: number },
][];

describe('spring', () => {
  for (const dt of [0.001, 0.008, 0.016, 0.033]) {
    for (const [name, { k, c }] of springs) {
      it(`${name} reaches its target with dt = ${dt * 1000} ms`, () => {
        const spring: Spring = { value: 0, velocity: 0 };
        for (let t = 0; t < 3; t += dt) {
          follow(spring, 1, k, c, dt);
          expect(Number.isFinite(spring.value)).toBe(true);
          expect(Math.abs(spring.value)).toBeLessThan(10);
        }
        expect(spring.value).toBeCloseTo(1, 2);
        expect(Math.abs(spring.velocity)).toBeLessThan(0.05);
      });
    }
  }
});
