import type { Toolpaths } from '../toolpath/toolpath';

export interface SvgOptions {
  /** Line width, mm. */
  strokeWidth?: number;
  /** Line color, any SVG paint. */
  stroke?: string;
  /** A fill behind the drawing, or null for none. */
  background?: string | null;
  /** How far, mm, a simplified line may stray from the samples it replaces.
   *  0 keeps every sample. */
  tolerance?: number;
  /** Draw the cut only as far as here: every pass before `pass` whole, and
   *  `pass` up to `sample`. The picture keeps the whole job's bounds, so the
   *  frames of a sequence line up. */
  upTo?: { pass: number; sample: number };
  /** Text stored in the file's `<metadata>`, such as a link to the settings
   *  that drew it. */
  metadata?: string;
}

/** Coordinates are written to the micrometer, finer than any plotter, laser
 *  or engraver resolves. */
const DECIMALS = 3;

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The toolpaths as an SVG drawing in mm, one polyline per pass, y up. */
export function toolpathsSvg(t: Toolpaths, options: SvgOptions = {}): string {
  const { strokeWidth = 0.02, stroke = 'black', background = null, tolerance = 0.001, upTo, metadata } = options;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of t.passes) {
    for (let i = 0; i < p.xyz.length; i += 3) {
      minX = Math.min(minX, p.xyz[i]);
      maxX = Math.max(maxX, p.xyz[i]);
      minY = Math.min(minY, -p.xyz[i + 1]);
      maxY = Math.max(maxY, -p.xyz[i + 1]);
    }
  }
  if (minX > maxX) minX = maxX = minY = maxY = 0;
  const pad = 1;
  const w = maxX - minX + 2 * pad;
  const h = maxY - minY + 2 * pad;
  const lines: string[] = [];
  for (const [k, p] of t.passes.entries()) {
    if (upTo && k > upTo.pass) break;
    const count = upTo && k === upTo.pass ? Math.min(upTo.sample + 1, p.xyz.length / 3) : p.xyz.length / 3;
    if (count < 2) continue;
    const xy = new Float64Array(2 * count);
    for (let i = 0; i < count; i++) {
      xy[2 * i] = p.xyz[3 * i];
      xy[2 * i + 1] = -p.xyz[3 * i + 1];
    }
    const pts = simplify(xy, tolerance).map((i) => `${xy[2 * i].toFixed(DECIMALS)},${xy[2 * i + 1].toFixed(DECIMALS)}`);
    lines.push(`<polyline points="${pts.join(' ')}"/>`);
  }
  const box = [minX - pad, minY - pad, w, h].map((v) => v.toFixed(DECIMALS));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(DECIMALS)}mm" height="${h.toFixed(DECIMALS)}mm" viewBox="${box.join(' ')}">`,
    ...(metadata === undefined ? [] : [`<metadata>${escape(metadata)}</metadata>`]),
    ...(background === null ? [] : [`<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="${escape(background)}"/>`]),
    `<g fill="none" stroke="${escape(stroke)}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round">`,
    ...lines,
    '</g>',
    '</svg>',
  ].join('\n');
}

/** Indices of the points a polyline keeps when every dropped point lies
 *  within `tolerance` of the line that replaces it (Ramer–Douglas–Peucker).
 *  `xy` is x, y pairs. */
export function simplify(xy: Float64Array, tolerance: number): number[] {
  const n = xy.length / 2;
  if (n <= 2 || tolerance <= 0) return Array.from({ length: n }, (_, i) => i);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = xy[2 * a];
    const ay = xy[2 * a + 1];
    const dx = xy[2 * b] - ax;
    const dy = xy[2 * b + 1] - ay;
    const len2 = dx * dx + dy * dy;
    let far = -1;
    let farDist = tolerance;
    for (let i = a + 1; i < b; i++) {
      const px = xy[2 * i] - ax;
      const py = xy[2 * i + 1] - ay;
      // Distance to the segment, not the infinite line, so a path that
      // doubles back on itself is not flattened.
      const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
      const d = Math.hypot(px - s * dx, py - s * dy);
      if (d > farDist) {
        far = i;
        farDist = d;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}
