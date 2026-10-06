import type { Toolpaths } from 'rosee';

/** Half-width, mm, of a square around the work axis holding every cut. */
export function fitExtent(t: Toolpaths): number {
  let r = 1;
  for (const p of t.passes) {
    for (let i = 0; i < p.xyz.length; i += 3) r = Math.max(r, Math.hypot(p.xyz[i], p.xyz[i + 1]));
  }
  return r * 1.05;
}
