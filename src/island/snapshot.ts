import type { WispState } from '../character/states';

// What the backend sends in `wisp://state` (Snapshot in src-tauri/src/app_state.rs).

export type TimerStatus = 'idle' | 'running' | 'paused';

export interface Snapshot {
  state: WispState;
  task: string | null;
  timer: {
    status: TimerStatus;
    remaining_ms: number;
    total_ms: number;
  };
}
