// All user-facing text lives in it.json, in Italian. Code never hardcodes UI strings.
// The JSON is shared with Rust (the tray menu is built there); this file gives it types.
import strings from './it.json';

export const it = strings;
