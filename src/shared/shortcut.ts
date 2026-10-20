import { en } from '../i18n/en';

/** "CommandOrControl+Shift+Space" -> "Ctrl+Shift+Space". */
export function shortcutLabel(accelerator: string): string {
  const names: Record<string, string> = en.keys;
  return accelerator
    .split('+')
    .map((part) => names[part] ?? part)
    .join('+');
}
