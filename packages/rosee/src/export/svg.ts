import type { Toolpaths } from '../toolpath/toolpath';

/** The toolpaths as an SVG drawing in mm, one polyline per pass, y up. */
export function toolpathsSvg(t: Toolpaths, strokeWidth = 0.02): string {
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
  const lines = t.passes.map((p) => {
    const pts: string[] = [];
    for (let i = 0; i < p.xyz.length; i += 3) pts.push(`${p.xyz[i].toFixed(4)},${(-p.xyz[i + 1]).toFixed(4)}`);
    return `<polyline points="${pts.join(' ')}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" viewBox="${(minX - pad).toFixed(3)} ${(minY - pad).toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}">`,
    `<g fill="none" stroke="black" stroke-width="${strokeWidth}">`,
    ...lines,
    '</g>',
    '</svg>',
  ].join('\n');
}
