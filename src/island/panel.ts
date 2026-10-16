// The open panel's right column: task, timer and buttons.
// Every button only tells the backend what the user did; the panel redraws
// when the backend answers with a new snapshot.

import { invoke } from '@tauri-apps/api/core';
import { it } from '../i18n/it';
import type { Snapshot } from './snapshot';

const QUICK_MINUTES = [15, 25, 45];

export function panelHtml(): string {
  const quick = QUICK_MINUTES.map(
    (m) => `<button class="chip" data-minutes="${m}">${m} ${it.island.minutes}</button>`,
  ).join('');
  return `
    <div class="details" data-timer="idle">
      <div class="label">${it.island.now}</div>
      <div class="task-row">
        <div class="task placeholder" tabindex="0">${it.island.taskPlaceholder}</div>
        <input class="task-input" type="text" maxlength="200" placeholder="${it.island.taskPlaceholder}" hidden />
      </div>
      <div class="time">${it.island.noTime}</div>
      <div class="progress"><div class="progress-fill"></div></div>
      <div class="controls">
        <div class="when-idle">
          ${quick}
          <button class="chip other">${it.island.otherDuration}</button>
          <input class="chip custom" type="number" min="1" max="240" placeholder="${it.island.minutes}" hidden />
        </div>
        <div class="when-active">
          <button class="chip pause">${it.island.pause}</button>
          <button class="chip resume">${it.island.resume}</button>
          <button class="chip stop">${it.island.stop}</button>
        </div>
        <button class="chip done" disabled>${it.island.done}</button>
      </div>
    </div>`;
}

/** Wires the panel and returns a function that draws a snapshot on it. */
export function setupPanel(root: HTMLElement): (snapshot: Snapshot) => void {
  const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const details = q<HTMLDivElement>('.details');
  const task = q<HTMLDivElement>('.task');
  const taskInput = q<HTMLInputElement>('.task-input');
  const other = q<HTMLButtonElement>('.other');
  const custom = q<HTMLInputElement>('.custom');
  const done = q<HTMLButtonElement>('.done');

  let current: Snapshot | null = null;

  // ---- Task: click to edit, Enter saves, Esc cancels ----

  const editTask = () => {
    taskInput.value = current?.task ?? '';
    task.hidden = true;
    taskInput.hidden = false;
    taskInput.focus();
  };
  task.addEventListener('click', editTask);
  task.addEventListener('keydown', (e) => e.key === 'Enter' && editTask());

  let cancelled = false;
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') taskInput.blur();
    if (e.key === 'Escape') {
      cancelled = true;
      taskInput.blur();
    }
  });
  // Leaving the field saves, unless Esc was pressed.
  taskInput.addEventListener('blur', () => {
    if (!cancelled) void invoke('set_task', { text: taskInput.value });
    cancelled = false;
    taskInput.hidden = true;
    task.hidden = false;
  });

  // ---- Timer ----

  for (const chip of root.querySelectorAll<HTMLButtonElement>('[data-minutes]')) {
    chip.addEventListener('click', () =>
      invoke('timer_start', { minutes: Number(chip.dataset.minutes) }),
    );
  }
  other.addEventListener('click', () => {
    other.hidden = true;
    custom.hidden = false;
    custom.value = '';
    custom.focus();
  });
  custom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && Number(custom.value) >= 1) {
      void invoke('timer_start', { minutes: Math.round(Number(custom.value)) });
      custom.blur();
    }
    if (e.key === 'Escape') custom.blur();
  });
  custom.addEventListener('blur', () => {
    custom.hidden = true;
    other.hidden = false;
  });

  q('.pause').addEventListener('click', () => invoke('timer_pause'));
  q('.resume').addEventListener('click', () => invoke('timer_resume'));
  q('.stop').addEventListener('click', () => invoke('timer_stop'));
  done.addEventListener('click', () => invoke('task_done'));

  // While the user types anywhere in the panel, the island must stay open.
  for (const field of [taskInput, custom]) {
    field.addEventListener('focus', () => invoke('set_editing', { editing: true }));
    field.addEventListener('blur', () => invoke('set_editing', { editing: false }));
  }

  return (snapshot) => {
    current = snapshot;
    details.dataset.timer = snapshot.timer.status;
    task.textContent = snapshot.task ?? it.island.taskPlaceholder;
    task.classList.toggle('placeholder', snapshot.task === null);
    done.disabled = snapshot.task === null;
  };
}
