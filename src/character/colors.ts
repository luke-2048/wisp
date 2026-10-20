// Wisp's palettes and colour maths. geometry.ts derives every body shade from one base colour.

export type PaletteName = 'lilla' | 'menta' | 'pesca';

export interface Palette {
  base: string;
  light: string; // done
  dim: string; // break
  night: string;
  shadow: string;
  warm: string;
}

export const palettes: Record<PaletteName, Palette> = {
  lilla: {
    base: '#DCD5FB',
    light: '#E9E4FF',
    dim: '#D2CDE2',
    night: '#BDB6DD',
    shadow: '#6E5FB8',
    warm: '#F9CBEB',
  },
  menta: {
    base: '#C9EEDF',
    light: '#DDF7EC',
    dim: '#CFDDD7',
    night: '#A9CFC1',
    shadow: '#3F8F7A',
    warm: '#FFF5C8',
  },
  pesca: {
    base: '#FFD8C6',
    light: '#FFE6DA',
    dim: '#E7D6CF',
    night: '#E0B8A8',
    shadow: '#C9735C',
    warm: '#FFEFC2',
  },
};

export const INK = '#2A2433';
export const CHEEK = '#FF8FA3';
export const WHITE = '#FFFFFF';

/** Red, green, blue, each 0..255. */
export type Rgb = [number, number, number];

/** Linear mix: t = 0 gives `from`, t = 1 gives `to`. */
export function mix(from: string, to: string, t: number): string {
  const a = toRgb(from);
  const b = toRgb(to);
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return toHex([channel(0), channel(1), channel(2)]);
}

export function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Channels are rounded and kept in 0..255, so a colour halfway through a fade still works. */
export function toHex(rgb: Rgb): string {
  const channel = (c: number) => Math.max(0, Math.min(255, Math.round(c)));
  return '#' + rgb.map((c) => channel(c).toString(16).padStart(2, '0').toUpperCase()).join('');
}
