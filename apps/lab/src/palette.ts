const BRASS = '#c9a35a';
const AMBER = '#e8a33d';
const RED = '#e5484d';

/** Every color the lab draws with, by what it marks: the canvases, the 3D
 *  machine, the GL surface, and (through `installPaletteVars`) the stylesheet. */
export const PALETTE = {
  background: '#101012',
  ink: '#c8c4bb',
  line: '#d9d4c7',
  faint: '#3a3a40',
  rosette: BRASS,
  rubber: '#7fb3d5',
  contact: '#e8e2d0',
  steep: RED,
  cutter: AMBER,
  stock: 'rgba(200, 200, 210, 0.12)',
  steel: '#8d9096',
  work: '#d8d6d0',
  ground: '#303036',
  glow: '#3a2a10',
  error: RED,
};

/** A `#rrggbb` color as linear RGB in [0, 1], decoded with the 2.2 gamma the
 *  surface shader encodes with, so it shows as exactly this hex. */
export function linear(hex: string): [number, number, number] {
  const channel = (k: number) => (Number.parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16) / 255) ** 2.2;
  return [channel(0), channel(1), channel(2)];
}

export type Palette = typeof PALETTE;

const CSS_VARS = ['background', 'ink', 'rosette', 'cutter', 'error'] as const;

/** Publishes the colors the stylesheet uses as `--rs-<name>` on :root. */
export function installPaletteVars(doc: Document = document): void {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`:root { ${CSS_VARS.map((k) => `--rs-${k}: ${PALETTE[k]};`).join(' ')} }`);
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
}
