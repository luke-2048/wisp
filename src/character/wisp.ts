// Wisp as a parametric SVG, built from assets/wisp.svg (viewBox 120x120).
// Every variant (eyes, mouths, symbols) is drawn once; `applyState` picks the
// visible ones through data attributes and sets colours and pose through CSS
// variables, so wisp.css can animate every change in 300 ms.

import { CHEEK, INK, bodyColors, type Palette } from './colors';
import { looks, type WispState } from './states';
import './wisp.css';

/** Colours come later, from `applyState`. */
export interface WispOptions {
  /** Prefix for the SVG ids, so two Wisps on the same page don't clash. */
  id: string;
  /** Small icon version for the closed bar: framed tightly, no ground shadow, no symbols. */
  mini?: boolean;
}

const BODY_PATH =
  'M60 26 C82 26 96 42 96 62 C96 78 88 88 78 92 C84 96 92 96 98 92 C96 102 84 106 72 100 ' +
  'C68 98 64 98 60 98 C40 98 24 84 24 62 C24 42 38 26 60 26 Z';

// Eye centres from the brief.
const LEFT_EYE = 47;
const RIGHT_EYE = 71;
const EYE_Y = 64;

export function renderWisp({ id, mini = false }: WispOptions): string {
  const ref = (name: string) => `url(#${id}-${name})`;
  const viewBox = mini ? '18 22 86 86' : '0 0 120 120';

  return `
<svg class="wisp${mini ? ' mini-wisp' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">
  <defs>
    <radialGradient id="${id}-body" cx="0.4" cy="0.32" r="0.78" fx="0.34" fy="0.24">
      <stop offset="0" style="stop-color: var(--hi)"/>
      <stop offset="0.5" style="stop-color: var(--base)"/>
      <stop offset="1" style="stop-color: var(--shade)"/>
    </radialGradient>
    <radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" style="stop-color: var(--glow)" stop-opacity="0.85"/>
      <stop offset="1" style="stop-color: var(--glow)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-soft" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-eye" cx="0.5" cy="0.72" r="0.7">
      <stop offset="0" stop-color="#5B4E72"/>
      <stop offset="1" stop-color="#221C2C"/>
    </radialGradient>
    <radialGradient id="${id}-halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFE58A" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#FFE58A" stop-opacity="0"/>
    </radialGradient>
    <filter id="${id}-blurS" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="${id}-blurM" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="${id}-blurL" x="-60%" y="-300%" width="220%" height="700%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <path id="${id}-shape" d="${BODY_PATH}"/>
    <clipPath id="${id}-clip"><use href="#${id}-shape"/></clipPath>
    <mask id="${id}-rim" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
      <use href="#${id}-shape" fill="#FFFFFF"/>
      <use href="#${id}-shape" transform="translate(-3.5 -3.5)" fill="#000000" filter="${ref('blurM')}"/>
    </mask>
  </defs>

  ${mini ? '' : groundShadow(ref('blurL'))}

  <g class="float">
    <g class="pose">
      <circle class="halo" cx="60" cy="62" r="50" fill="${ref('halo')}"/>

      <g class="body">
        <ellipse class="arm arm-left" cx="0" cy="0" rx="5.2" ry="7.6" fill="${ref('body')}"/>
        <ellipse class="arm arm-right" cx="0" cy="0" rx="5.2" ry="7.6" fill="${ref('body')}"/>

        <use href="#${id}-shape" fill="${ref('body')}"/>
        <g clip-path="${ref('clip')}">
          <ellipse cx="62" cy="97" rx="36" ry="16" fill="${ref('glow')}"/>
          <rect class="rim" x="0" y="0" width="120" height="120" opacity="0.6" mask="${ref('rim')}"/>
        </g>

        <ellipse cx="45" cy="41" rx="14" ry="8" transform="rotate(-30 45 41)" fill="${ref('soft')}" opacity="0.75"/>
        <ellipse cx="41" cy="38" rx="4.6" ry="2.6" transform="rotate(-32 41 38)" fill="#FFFFFF" opacity="0.9"/>
        <circle cx="50" cy="33" r="1.3" fill="#FFFFFF" opacity="0.8"/>
        <circle cx="80" cy="38" r="1.6" fill="#FFFFFF" opacity="0.55"/>
      </g>

      <g class="face">
        <ellipse cx="37" cy="73" rx="6" ry="3.6" fill="${CHEEK}" opacity="0.6" filter="${ref('blurS')}"/>
        <ellipse cx="81" cy="73" rx="6" ry="3.6" fill="${CHEEK}" opacity="0.6" filter="${ref('blurS')}"/>
        ${eyes(ref('eye'))}
        ${mouths()}
      </g>

      ${mini ? '' : symbols()}
    </g>
  </g>
</svg>`;
}

/** Shows `state` on a Wisp rendered by `renderWisp`. */
export function applyState(svg: SVGSVGElement, state: WispState, palette: Palette): void {
  const look = looks[state];
  const c = bodyColors(palette[look.color], palette);
  svg.dataset.state = state;
  svg.dataset.eyes = look.eyes;
  svg.dataset.mouth = look.mouth;
  svg.dataset.arms = look.arms;
  svg.style.setProperty('--hi', c.highlight);
  svg.style.setProperty('--base', c.base);
  svg.style.setProperty('--shade', c.shade);
  svg.style.setProperty('--glow', c.glow);
  svg.style.setProperty('--rim', c.rim);
  svg.style.setProperty('--body-opacity', String(look.bodyOpacity));
  svg.style.setProperty('--pose', look.pose);
}

function groundShadow(blur: string): string {
  return `
  <g class="ground">
    <ellipse cx="60" cy="111" rx="20" ry="3.4" fill="#1D2230" opacity="0.22" filter="${blur}"/>
    <ellipse class="ground-light" cx="60" cy="110" rx="15" ry="2" opacity="0.45" filter="${blur}"/>
  </g>`;
}

function eyes(eyeFill: string): string {
  const both = (draw: (x: number) => string) => draw(LEFT_EYE) + draw(RIGHT_EYE);
  const round = (rx: number, ry: number, glint: number) =>
    both(
      (x) => `
        <ellipse cx="${x}" cy="${EYE_Y}" rx="${rx}" ry="${ry}" fill="${eyeFill}"/>
        <circle cx="${x + 1.6}" cy="${EYE_Y - 2.2}" r="${glint}" fill="#FFFFFF"/>
        <circle cx="${x - 1.4}" cy="${EYE_Y + 2.2}" r="${glint / 2}" fill="#FFFFFF"/>`,
    );
  const line = (d: string) =>
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;

  return `
        <g class="eyes eyes-dot"><g class="blinkable">${round(4.2, 5.6, 1.7)}</g></g>
        <g class="eyes eyes-side"><g transform="translate(2.6 -1)"><g class="blinkable">${round(4.2, 5.6, 1.7)}</g></g></g>
        <g class="eyes eyes-wide"><g class="blinkable">${round(5, 6.6, 2)}</g></g>
        <g class="eyes eyes-tired">${both(
          (x) => `
          <path d="M${x - 4.2} 63 A4.2 4.2 0 0 0 ${x + 4.2} 63 Z" fill="${eyeFill}"/>
          ${line(`M${x - 4.8} 63 H${x + 4.8}`)}`,
        )}</g>
        <g class="eyes eyes-happy">${both((x) => line(`M${x - 4.4} 66 Q${x} 59 ${x + 4.4} 66`))}</g>
        <g class="eyes eyes-closed">${both((x) => line(`M${x - 4.4} 63.5 Q${x} 68.5 ${x + 4.4} 63.5`))}</g>`;
}

function mouths(): string {
  const stroke = `fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  return `
        <path class="mouth mouth-calm" d="M55.5 72 Q57.25 74.6 59 72 Q60.75 74.6 62.5 72" ${stroke}/>
        <path class="mouth mouth-wavy" d="M53.5 73 Q55.25 71 57 73 T60.5 73 T64 73" ${stroke}/>
        <path class="mouth mouth-flat" d="M56 73 H62" ${stroke}/>
        <ellipse class="mouth mouth-o" cx="59" cy="73.5" rx="2.2" ry="2.6" fill="${INK}"/>
        <path class="mouth mouth-grin" d="M54 71 Q59 79 64 71 Z" fill="${INK}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
        <circle class="mouth mouth-sleep" cx="59" cy="73" r="1.3" fill="${INK}"/>`;
}

/** A four-pointed sparkle centred on (x, y). */
function sparkle(x: number, y: number, r: number): string {
  return `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="#FFD45C"/>`;
}

function symbols(): string {
  const font = `font-family="Segoe UI, system-ui, sans-serif" font-weight="800" text-anchor="middle"`;
  return `
      <g class="symbol symbol-distracted">
        <text x="95" y="38" font-size="18" fill="#F5A04A" ${font}>?</text>
      </g>
      <g class="symbol symbol-break">
        <path d="M92 26 C92 26 97 33 97 36.5 A5 5 0 0 1 87 36.5 C87 33 92 26 92 26 Z" fill="#8EC9F2"/>
        <ellipse cx="90.3" cy="35.5" rx="1.1" ry="1.8" fill="#FFFFFF" opacity="0.8"/>
      </g>
      <g class="symbol symbol-waiting">
        <circle cx="95" cy="30" r="8" fill="#5B8DEF"/>
        <text x="95" y="34.5" font-size="12" fill="#FFFFFF" ${font}>!</text>
      </g>
      <g class="symbol symbol-done">
        ${sparkle(96, 28, 6)}${sparkle(24, 36, 4.5)}${sparkle(103, 46, 3)}
      </g>
      <g class="symbol symbol-night">
        <text x="88" y="38" font-size="11" fill="#9A97A8" ${font}>z</text>
        <text x="97" y="29" font-size="8" fill="#9A97A8" ${font}>z</text>
      </g>`;
}
