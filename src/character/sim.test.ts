import { describe, expect, it } from 'vitest';
import { stateExpression, WISP_STATES } from './params';
import { Sim } from './sim';

describe('sim', () => {
  for (const from of WISP_STATES) {
    for (const to of WISP_STATES) {
      it(`goes from ${from} to ${to} in 2 s`, () => {
        // A fixed "random" keeps the test the same every time.
        const sim = new Sim({ mode: 'island', state: from, random: () => 0.5 });
        sim.state = to;
        for (let t = 0; t < 2; t += 1 / 60) sim.tick(1 / 60);
        const now = sim.expression();
        const target = stateExpression(to);
        for (const key of Object.keys(target) as (keyof typeof target)[]) {
          expect(Math.abs(now[key] - target[key]), key).toBeLessThan(0.05);
        }
      });
    }
  }

  it('bounces back home after a poke', () => {
    const sim = new Sim({ mode: 'island', random: () => 0.5, reducedMotion: true });
    sim.bounce();
    for (let t = 0; t < 3; t += 1 / 60) sim.tick(1 / 60);
    expect(Math.abs(sim.offset().y)).toBeLessThan(1);
  });
});
