// The animation loop. It runs once per screen refresh and stops while the
// window is hidden (island hidden from the tray): then Wisp costs no CPU.

/** What the loop needs from the browser; tests pass a fake one. */
export interface Scheduler {
  request(callback: (now: number) => void): number;
  cancel(handle: number): void;
  isHidden(): boolean;
  /** Calls `callback` when the window is shown or hidden; returns how to stop listening. */
  onVisibilityChange(callback: () => void): () => void;
}

export const browserScheduler: Scheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
  isHidden: () => document.hidden,
  onVisibilityChange(callback) {
    document.addEventListener('visibilitychange', callback);
    return () => document.removeEventListener('visibilitychange', callback);
  },
};

/** The longest step we simulate: after a slow frame Wisp slows down rather than jumping. */
const MAX_DT = 0.033;

export interface Loop {
  /** True while frames are being requested. */
  running(): boolean;
  stop(): void;
}

/** Calls `frame(dt)` (seconds) on every refresh while the window is visible. */
export function startLoop(
  frame: (dt: number) => void,
  scheduler: Scheduler = browserScheduler,
): Loop {
  let handle: number | null = null;
  let last: number | null = null;
  let stopped = false;

  const onFrame = (now: number) => {
    handle = null;
    if (stopped || scheduler.isHidden()) {
      last = null; // the next frame after showing must not see a huge dt
      return;
    }
    const dt = last === null ? 1 / 60 : Math.min(MAX_DT, Math.max(0.001, (now - last) / 1000));
    last = now;
    frame(dt);
    handle = scheduler.request(onFrame);
  };

  const resume = () => {
    if (!stopped && handle === null && !scheduler.isHidden()) handle = scheduler.request(onFrame);
  };
  const unlisten = scheduler.onVisibilityChange(resume);
  resume();

  return {
    running: () => handle !== null,
    stop() {
      stopped = true;
      unlisten();
      if (handle !== null) scheduler.cancel(handle);
      handle = null;
    },
  };
}
