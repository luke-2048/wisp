import { describe, expect, it } from 'vitest';
import { pointerDown, pointerMove, pointerUp } from './input';
import { Sim } from './sim';

const run = (sim: Sim, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) sim.tick(1 / 60);
};
const newSim = () => new Sim({ mode: 'island', random: () => 0.5, elastic: 80 });

describe('input', () => {
  it('a click squashes while held, then bounces up', () => {
    const sim = newSim();
    pointerDown(sim, { x: 0, y: 0 });
    run(sim, 0.3);
    expect(sim.pose().squash.y).toBeLessThan(0.9);
    pointerUp(sim);
    run(sim, 0.1);
    expect(sim.offset().y).toBeLessThan(0); // up
  });

  it('a drag in the island stretches like an elastic, never past its limit', () => {
    const sim = newSim();
    pointerDown(sim, { x: 0, y: 0 });
    pointerMove(sim, { x: 0, y: 1000 });
    expect(sim.input.dragging).toBe(true);
    run(sim, 1);
    expect(sim.offset().y).toBeGreaterThan(60);
    expect(sim.offset().y).toBeLessThanOrEqual(80);
    pointerUp(sim);
    run(sim, 3);
    expect(Math.abs(sim.offset().y)).toBeLessThan(1);
  });

  it('moving back and forth over Wisp is a caress', () => {
    const sim = newSim();
    sim.state = 'focused';
    for (let i = 0; i < 20; i++) {
      pointerMove(sim, { x: i % 2 ? 60 : -60, y: 0 });
      sim.tick(1 / 60);
    }
    run(sim, 1);
    expect(sim.expression().blush).toBeGreaterThan(1);
  });
});
