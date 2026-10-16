// Wisp as a parametric SVG, built from assets/wisp.svg (viewBox 120x120).
// Step 1 draws only the "focused" look; step 2 makes eyes, mouth, arms and
// body follow the state sent by the backend.

import { CHEEK, INK, bodyColors, type Palette } from './colors';

export interface WispOptions {
  palette: Palette;
  /** Prefix for the SVG ids, so two Wisps on the same page don't clash. */
  id: string;
}

const BODY_PATH =
  'M60 26 C82 26 96 42 96 62 C96 78 88 88 78 92 C84 96 92 96 98 92 C96 102 84 106 72 100 ' +
  'C68 98 64 98 60 98 C40 98 24 84 24 62 C24 42 38 26 60 26 Z';

export function renderWisp({ palette, id }: WispOptions): string {
  const c = bodyColors(palette.base, palette);
  const ref = (name: string) => `url(#${id}-${name})`;

  return `
<svg class="wisp" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <radialGradient id="${id}-body" cx="0.4" cy="0.32" r="0.78" fx="0.34" fy="0.24">
      <stop offset="0" stop-color="${c.highlight}"/>
      <stop offset="0.5" stop-color="${c.base}"/>
      <stop offset="1" stop-color="${c.shade}"/>
    </radialGradient>
    <radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${c.glow}" stop-opacity="0.85"/>
      <stop offset="1" stop-color="${c.glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-soft" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-eye" cx="0.5" cy="0.72" r="0.7">
      <stop offset="0" stop-color="#5B4E72"/>
      <stop offset="1" stop-color="#221C2C"/>
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

  <ellipse cx="60" cy="111" rx="20" ry="3.4" fill="#1D2230" opacity="0.22" filter="${ref('blurL')}"/>
  <ellipse cx="60" cy="110" rx="15" ry="2" fill="${c.base}" opacity="0.45" filter="${ref('blurL')}"/>

  <g class="wisp-float">
    <ellipse cx="26" cy="74" rx="5.2" ry="7.6" transform="rotate(28 26 74)" fill="${ref('body')}"/>
    <ellipse cx="94" cy="74" rx="5.2" ry="7.6" transform="rotate(-28 94 74)" fill="${ref('body')}"/>

    <use href="#${id}-shape" fill="${ref('body')}"/>
    <g clip-path="${ref('clip')}">
      <ellipse cx="62" cy="97" rx="36" ry="16" fill="${ref('glow')}"/>
      <rect x="0" y="0" width="120" height="120" fill="${c.rim}" opacity="0.6" mask="${ref('rim')}"/>
    </g>

    <ellipse cx="45" cy="41" rx="14" ry="8" transform="rotate(-30 45 41)" fill="${ref('soft')}" opacity="0.75"/>
    <ellipse cx="41" cy="38" rx="4.6" ry="2.6" transform="rotate(-32 41 38)" fill="#FFFFFF" opacity="0.9"/>
    <circle cx="50" cy="33" r="1.3" fill="#FFFFFF" opacity="0.8"/>
    <circle cx="80" cy="38" r="1.6" fill="#FFFFFF" opacity="0.55"/>

    <ellipse cx="37" cy="73" rx="6" ry="3.6" fill="${CHEEK}" opacity="0.6" filter="${ref('blurS')}"/>
    <ellipse cx="81" cy="73" rx="6" ry="3.6" fill="${CHEEK}" opacity="0.6" filter="${ref('blurS')}"/>

    <ellipse cx="47" cy="64" rx="4.2" ry="5.6" fill="${ref('eye')}"/>
    <ellipse cx="71" cy="64" rx="4.2" ry="5.6" fill="${ref('eye')}"/>
    <circle cx="48.6" cy="61.8" r="1.7" fill="#FFFFFF"/>
    <circle cx="72.6" cy="61.8" r="1.7" fill="#FFFFFF"/>
    <circle cx="45.6" cy="66.2" r="0.8" fill="#FFFFFF"/>
    <circle cx="69.6" cy="66.2" r="0.8" fill="#FFFFFF"/>

    <path d="M55.5 72 Q57.25 74.6 59 72 Q60.75 74.6 62.5 72" fill="none" stroke="${INK}"
      stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}
