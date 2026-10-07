import { sheetPeriod, type Toolpaths } from 'rosee';

/** The part of the sheet the output shows at zoom 1, mm: its center and
 *  half-size. A face or dome is a square round the work axis holding every
 *  cut; a barrel is its whole circumference by the length cut. */
export interface Fit {
  center: [number, number];
  half: [number, number];
}

export function fitSheet(t: Toolpaths): Fit {
  const period = sheetPeriod(t.surface);
  if (period > 0) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of t.passes) {
      for (let i = 1; i < p.uvh.length; i += 3) {
        lo = Math.min(lo, p.uvh[i]);
        hi = Math.max(hi, p.uvh[i]);
      }
    }
    if (!(lo <= hi)) lo = hi = 0;
    return { center: [0, (lo + hi) / 2], half: [period / 2, (hi - lo) / 2 + 1] };
  }
  let r = 1;
  for (const p of t.passes) {
    for (let i = 0; i < p.uvh.length; i += 3) r = Math.max(r, Math.hypot(p.uvh[i], p.uvh[i + 1]));
  }
  return { center: [0, 0], half: [r * 1.05, r * 1.05] };
}
