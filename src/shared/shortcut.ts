import { it } from '../i18n/it';

/** "CommandOrControl+Shift+Space" -> "Ctrl+Shift+Spazio". */
export function shortcutLabel(accelerator: string): string {
  const names: Record<string, string> = it.keys;
  return accelerator
    .split('+')
    .map((part) => names[part] ?? part)
    .join('+');
}
