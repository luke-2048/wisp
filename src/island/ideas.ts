// The list of parked ideas inside the open panel: newest first, with date and
// time; each can be marked as seen or deleted. The backend owns the list.

import { invoke } from '@tauri-apps/api/core';
import { it } from '../i18n/it';
import type { ParkedIdea } from './snapshot';

export function ideasHtml(): string {
  return `
    <div class="ideas-view">
      <div class="ideas-head">
        <button class="back">‹ ${it.ideas.back}</button>
        <span class="label">${it.ideas.title}</span>
      </div>
      <ul class="ideas-list"></ul>
      <div class="ideas-empty">${it.ideas.empty}</div>
    </div>`;
}

/** Wires the list; returns a function that redraws it from the snapshot. */
export function setupIdeas(root: HTMLElement, back: () => void): (ideas: ParkedIdea[]) => void {
  const list = root.querySelector<HTMLUListElement>('.ideas-list')!;
  const empty = root.querySelector<HTMLDivElement>('.ideas-empty')!;
  root.querySelector('.back')!.addEventListener('click', back);

  let drawn = '';
  return (ideas) => {
    // Snapshots arrive every second while the timer runs: redraw only on change.
    const key = JSON.stringify(ideas);
    if (key === drawn) return;
    drawn = key;
    empty.hidden = ideas.length > 0;
    list.replaceChildren(...ideas.map(ideaItem));
  };
}

function ideaItem(idea: ParkedIdea): HTMLLIElement {
  // Built with textContent, never innerHTML: the text is whatever the user typed.
  const item = document.createElement('li');
  item.className = idea.seen ? 'idea seen' : 'idea';

  const text = document.createElement('div');
  text.className = 'idea-text';
  text.textContent = idea.text;

  const meta = document.createElement('div');
  meta.className = 'idea-meta';
  const when = document.createElement('span');
  when.textContent = formatWhen(idea.created_ms);
  meta.append(when);

  if (!idea.seen) {
    meta.append(action(it.ideas.seen, () => invoke('idea_seen', { id: idea.id })));
  }
  meta.append(action(it.ideas.delete, () => invoke('idea_delete', { id: idea.id })));

  item.append(text, meta);
  return item;
}

function action(label: string, run: () => Promise<unknown>): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'idea-action';
  button.textContent = label;
  button.addEventListener('click', () => void run());
  return button;
}

/** "oggi, 14:32" or "16 ott, 14:32". */
function formatWhen(ms: number): string {
  const date = new Date(ms);
  const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const today = new Date().toDateString() === date.toDateString();
  const day = today
    ? it.ideas.today
    : date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}
