import { describe, expect, it } from 'vitest';
import { startLoop, type Scheduler } from './loop';

/** A pretend browser: frames run only when the test says so. */
function fakeScheduler() {
  let pending: ((now: number) => void) | null = null;
  let listener: (() => void) | null = null;
  let now = 0;
  const fake: {
    hidden: boolean;
    requests: number;
    scheduler: Scheduler;
    frame(): void;
    setHidden(hidden: boolean): void;
  } = {
    hidden: false,
    requests: 0,
    scheduler: {
      request(callback) {
        fake.requests++;
        pending = callback;
        return fake.requests;
      },
      cancel() {
        pending = null;
      },
      isHidden: () => fake.hidden,
      onVisibilityChange(callback) {
        listener = callback;
        return () => (listener = null);
      },
    },
    /** Runs the frame the loop asked for, if any. */
    frame() {
      const callback = pending;
      pending = null;
      now += 16;
      callback?.(now);
    },
    setHidden(hidden: boolean) {
      fake.hidden = hidden;
      listener?.();
    },
  };
  return fake;
}

describe('loop', () => {
  it('stops while the window is hidden and starts again when shown', () => {
    const fake = fakeScheduler();
    let frames = 0;
    const loop = startLoop(() => frames++, fake.scheduler);

    fake.frame();
    fake.frame();
    expect(frames).toBe(2);

    fake.setHidden(true);
    fake.frame(); // the frame already asked for sees the window hidden and stops
    const requests = fake.requests;
    fake.frame();
    fake.frame();
    expect(frames).toBe(2);
    expect(fake.requests).toBe(requests);
    expect(loop.running()).toBe(false);

    fake.setHidden(false);
    expect(loop.running()).toBe(true);
    fake.frame();
    expect(frames).toBe(3);

    loop.stop();
    fake.frame();
    expect(frames).toBe(3);
  });
});
