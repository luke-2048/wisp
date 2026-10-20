// Builds Wisp's SVG once, then on every frame only changes attributes:
// no innerHTML per frame, so the browser never rebuilds the drawing.

import { CHEEK, INK } from './colors';
import type { Frame } from './geometry';
import { SYMBOLS, type SymbolName } from './params';

const SVG = 'http://www.w3.org/2000/svg';

/** Scene units per viewBox unit (Wisp's 120-unit viewBox is 300 scene units wide). */
export const SCENE_PER_VIEWBOX = 2.5;

export interface RenderOptions {
  /** Prefix for the SVG ids, so several Wisps can share a page. */
  id: string;
  /** Small icon framing: tight viewBox, no ground shadow, no symbols. */
  compact: boolean;
  /** Width and height in CSS pixels. */
  size: number;
}

/** Full frame, or tight around the body (with room to float) for small icons. */
const FULL_VIEWBOX = { x: 0, y: 0, size: 120 };
const COMPACT_VIEWBOX = { x: 15, y: 18, size: 92 };

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Renderer {
  /** The element to put in the page. */
  readonly root: HTMLDivElement;
  readonly svg: SVGSVGElement;
  /** Draws one frame; `offset` is Wisp's position in scene units, relative to home. */
  draw(frame: Frame, offset: { x: number; y: number }): void;
  /** Pixels per scene unit at the current size. */
  pixelsPerUnit(): number;
}

export function createRenderer({ id, compact, size }: RenderOptions): Renderer {
  const viewBox = compact ? COMPACT_VIEWBOX : FULL_VIEWBOX;
  const ref = (name: string) => `url(#${id}-${name})`;
  const symbols = compact
    ? ''
    : `
    <text data-part="question" x="104" y="30" font-weight="800" font-size="20" fill="#D98A1E" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif">?</text>
    <path data-part="sweat" d="M100 34 Q104 40 104 43 A4 4 0 0 1 96 43 Q96 40 100 34 Z" fill="#8EC5F0"/>
    <g data-part="bang"><circle cx="102" cy="20" r="9" fill="#4F74E3"/><text x="102" y="25" font-weight="800" font-size="13" fill="#FFFFFF" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif">!</text></g>
    <g data-part="spark" fill="#F6C343">
      <path d="M14 16 Q14 22 20 22 Q14 22 14 28 Q14 22 8 22 Q14 22 14 16 Z"/>
      <path d="M104 4 Q104 9 109 9 Q104 9 104 14 Q104 9 99 9 Q104 9 104 4 Z"/>
      <path d="M12 84 Q12 88 16 88 Q12 88 12 92 Q12 88 8 88 Q12 88 12 84 Z"/>
    </g>
    <g data-part="zzz" font-weight="800" fill="#7A8099" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif"><text x="98" y="36" font-size="13">z</text><text x="108" y="24" font-size="10">z</text></g>`;

  // Built once, from a template. Parts that change are found by `data-part`.
  const root = document.createElement('div');
  root.className = 'wisp-stage';
  root.style.cssText = `position:relative;width:${size}px;height:${size}px;`;
  root.innerHTML = `
<div data-part="shadow" style="position:absolute;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side, rgba(29,34,48,0.3), rgba(29,34,48,0));${compact ? 'display:none;' : ''}"></div>
<svg xmlns="${SVG}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.size} ${viewBox.size}" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;touch-action:none;" aria-hidden="true">
  <defs>
    <radialGradient id="${id}-body" data-part="gradient" cx="0.4" cy="0.32" r="0.78" fx="0.34" fy="0.24">
      <stop data-part="hi" offset="0"/><stop data-part="mid" offset="0.5"/><stop data-part="lo" offset="1"/>
    </radialGradient>
    <radialGradient id="${id}-sss" cx="0.5" cy="0.5" r="0.5">
      <stop data-part="sss0" offset="0" stop-opacity="0.85"/><stop data-part="sss1" offset="1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-soft" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-eye" cx="0.5" cy="0.72" r="0.7">
      <stop offset="0" stop-color="#5B4E72"/><stop offset="1" stop-color="#221C2C"/>
    </radialGradient>
    <radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFE89A" stop-opacity="0.9"/><stop offset="1" stop-color="#FFE89A" stop-opacity="0"/>
    </radialGradient>
    <filter id="${id}-blur-s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="${id}-blur-m" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <clipPath id="${id}-clip"><path data-part="clip"/></clipPath>
    <mask id="${id}-rim" maskUnits="userSpaceOnUse" x="-20" y="-20" width="160" height="160">
      <path data-part="rimA" fill="#FFFFFF"/>
      <path data-part="rimB" fill="#000000" filter="${ref('blur-m')}"/>
    </mask>
  </defs>
  <circle data-part="halo" cx="60" cy="64" r="54" fill="${ref('glow')}"/>
  <g data-part="bob">
    <g data-part="squash">
      <g data-part="opacity">
        <ellipse data-part="armL" rx="5.2" ry="7.6" fill="${ref('body')}"/>
        <ellipse data-part="armR" rx="5.2" ry="7.6" fill="${ref('body')}"/>
        <path data-part="body" fill="${ref('body')}"/>
        <g clip-path="${ref('clip')}">
          <ellipse cx="62" cy="97" rx="36" ry="16" fill="${ref('sss')}"/>
          <rect data-part="rim" x="-20" y="-20" width="160" height="160" opacity="0.6" mask="${ref('rim')}"/>
        </g>
        <ellipse data-part="h1" rx="14" ry="8" opacity="0.75" fill="${ref('soft')}"/>
        <ellipse data-part="h2" rx="4.6" ry="2.6" opacity="0.9" fill="#FFFFFF"/>
        <circle data-part="h3" r="1.3" opacity="0.8" fill="#FFFFFF"/>
      </g>
      <ellipse data-part="cheekL" ry="3.6" fill="${CHEEK}" filter="${ref('blur-s')}"/>
      <ellipse data-part="cheekR" ry="3.6" fill="${CHEEK}" filter="${ref('blur-s')}"/>
      <path data-part="eyeL" fill="${ref('eye')}" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path data-part="eyeR" fill="${ref('eye')}" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle data-part="g1" r="1.6" fill="#FFFFFF"/><circle data-part="g2" r="1.6" fill="#FFFFFF"/>
      <circle data-part="k1" r="0.8" fill="#FFFFFF"/><circle data-part="k2" r="0.8" fill="#FFFFFF"/>
      <path data-part="mouth" fill="${INK}" stroke="${INK}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    ${symbols}
  </g>
</svg>`;

  const svg = root.querySelector('svg')!;
  // Every part looked up once, here; `set` skips the ones a compact Wisp doesn't have.
  const parts = new Map<string, Element>();
  for (const el of root.querySelectorAll('[data-part]'))
    parts.set(el.getAttribute('data-part')!, el);
  const shadow = parts.get('shadow') as HTMLDivElement;

  // Only touch an attribute when its value really changed.
  const last = new Map<Element, Map<string, string>>();
  const set = (name: string, attributes: Record<string, string | number>) => {
    const el = parts.get(name);
    if (!el) return;
    let seen = last.get(el);
    if (!seen) last.set(el, (seen = new Map()));
    for (const [key, raw] of Object.entries(attributes)) {
      const value = typeof raw === 'number' ? String(r2(raw)) : raw;
      if (seen.get(key) !== value) {
        el.setAttribute(key, value);
        seen.set(key, value);
      }
    }
  };
  const ellipseAt = (name: string, p: { x: number; y: number }, angle?: number) =>
    set(name, {
      cx: p.x,
      cy: p.y,
      ...(angle === undefined ? {} : { transform: `rotate(${r2(angle)} ${r2(p.x)} ${r2(p.y)})` }),
    });

  // Fixed size: no layout reads while animating.
  const unit = size / (viewBox.size * SCENE_PER_VIEWBOX);
  const pixelsPerUnit = () => unit;

  return {
    root,
    svg,
    pixelsPerUnit,
    draw(f, offset) {
      const u = unit;
      svg.style.transform = `translate(${r2(offset.x * u)}px, ${r2(offset.y * u)}px)`;
      if (!compact) {
        // The ground shadow stays on the ground: it shrinks and fades as Wisp rises.
        // As in the reference: the ground is 135 scene units below Wisp's centre.
        const centre = size / 2;
        const ground = size / 2 + 135 * u;
        shadow.style.left = `${r2(centre + offset.x * u - (f.shadow.width * u) / 2)}px`;
        shadow.style.top = `${r2(ground - (f.shadow.height * u) / 2)}px`;
        shadow.style.width = `${r2(f.shadow.width * u)}px`;
        shadow.style.height = `${r2(f.shadow.height * u)}px`;
        shadow.style.opacity = String(r2(f.shadow.opacity));
      }

      set('hi', { 'stop-color': f.colors.highlight });
      set('mid', { 'stop-color': f.colors.base });
      set('lo', { 'stop-color': f.colors.shade });
      set('sss0', { 'stop-color': f.colors.glow });
      set('sss1', { 'stop-color': f.colors.glow });
      set('gradient', { fx: f.gradientFx });
      set('clip', { d: f.body });
      set('rimA', { d: f.body });
      set('rimB', { d: f.body, transform: f.rim });
      set('halo', { opacity: f.halo });
      set('bob', { transform: `translate(0 ${f.offsetY})` });
      set('squash', { transform: f.squash });
      set('opacity', { opacity: f.bodyOpacity });
      ellipseAt('armL', f.arms.left, f.arms.left.angle);
      ellipseAt('armR', f.arms.right, f.arms.right.angle);
      set('body', { d: f.body });
      set('rim', { fill: f.colors.rim });
      ellipseAt('h1', f.highlights[0], -30);
      ellipseAt('h2', f.highlights[1], -32);
      ellipseAt('h3', f.highlights[2]);
      set('cheekL', {
        cx: f.cheeks.left.x,
        cy: f.cheeks.left.y,
        rx: f.cheeks.left.rx,
        opacity: f.cheeks.opacity,
      });
      set('cheekR', {
        cx: f.cheeks.right.x,
        cy: f.cheeks.right.y,
        rx: f.cheeks.right.rx,
        opacity: f.cheeks.opacity,
      });
      set('eyeL', { d: f.eyes.left.d });
      set('eyeR', { d: f.eyes.right.d });
      set('g1', {
        cx: f.eyes.left.glint.x,
        cy: f.eyes.left.glint.y,
        opacity: f.eyes.left.glintOpacity,
      });
      set('g2', {
        cx: f.eyes.right.glint.x,
        cy: f.eyes.right.glint.y,
        opacity: f.eyes.right.glintOpacity,
      });
      set('k1', {
        cx: f.eyes.left.sparkle.x,
        cy: f.eyes.left.sparkle.y,
        opacity: f.eyes.left.glintOpacity,
      });
      set('k2', {
        cx: f.eyes.right.sparkle.x,
        cy: f.eyes.right.sparkle.y,
        opacity: f.eyes.right.glintOpacity,
      });
      set('mouth', { d: f.mouth.d, 'fill-opacity': f.mouth.fillOpacity });
      for (const name of SYMBOLS) set(name, { opacity: f.symbols[name as SymbolName] });
    },
  };
}
