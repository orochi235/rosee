import { type Cutter, grooveWidth } from '../cutter/cutter';
import { sheetPeriod } from '../surface/surface';
import type { Toolpaths } from '../toolpath/toolpath';

/** One pass as triangles (u, v, h per vertex, mm), laid out segment by
 *  segment so a prefix of the buffer is the pass cut up to a sample. */
export interface PassMesh {
  vertices: Float32Array;
  vertsPerSegment: number;
}

/** A rectangle of the sheet, mm. */
export interface SheetBounds {
  u: [number, number];
  v: [number, number];
}

export interface CarveMesh {
  passes: PassMesh[];
  /** The part of the sheet the carve holds: a square centered on the work
   *  axis, or on a barrel its whole circumference by the length cut. */
  bounds: SheetBounds;
  /** How far the sheet repeats in u, mm; 0 when it does not. A pass is
   *  meshed unbroken across the seam, so its u runs past the bounds, and is
   *  drawn again a period over each way. */
  period: number;
  /** The deepest height the carve represents, mm (negative). */
  floor: number;
}

/** The graver swept along each pass on its surface's sheet. At every sample
 *  the cutter is a V profile across `across`; consecutive profiles are
 *  joined by quads, which is exact for a V moved without turning and close
 *  when it turns slowly. */
export function carveMesh(t: Toolpaths, cutter: Cutter): CarveMesh {
  const flat = cutter.tipFlat / 2;
  const quads = flat > 0 ? 3 : 2;
  const vertsPerSegment = quads * 6;
  const period = sheetPeriod(t.surface);
  let extent = 0;
  let vMin = Infinity;
  let vMax = -Infinity;
  let deepest = 0;
  const passes = t.passes.map((p): PassMesh => {
    const n = p.across.length;
    // Per sample, the profile's corners: surface-left, tip-left, tip-right, surface-right.
    const profile = new Float32Array(n * 4 * 3);
    let u = 0;
    for (let i = 0; i < n; i++) {
      const raw = p.uvh[i * 3];
      if (i === 0 || !(period > 0)) u = raw;
      else {
        const step = raw - p.uvh[(i - 1) * 3];
        u += step - period * Math.round(step / period);
      }
      const v = p.uvh[i * 3 + 1];
      const h = Math.min(p.uvh[i * 3 + 2], 0);
      const au = Math.cos(p.across[i]);
      const av = Math.sin(p.across[i]);
      const half = grooveWidth(cutter, -h) / 2;
      const corners: [number, number][] = [
        [-half, 0],
        [-flat, h],
        [flat, h],
        [half, 0],
      ];
      corners.forEach(([off, hh], k) => {
        const cu = u + au * off;
        const cv = v + av * off;
        profile.set([cu, cv, hh], (i * 4 + k) * 3);
        extent = Math.max(extent, Math.abs(cu), Math.abs(cv));
        vMin = Math.min(vMin, cv);
        vMax = Math.max(vMax, cv);
        deepest = Math.min(deepest, hh);
      });
    }
    const pairs: [number, number][] = flat > 0 ? [[0, 1], [1, 2], [2, 3]] : [[0, 1], [2, 3]];
    const vertices = new Float32Array((n - 1) * vertsPerSegment * 3);
    let o = 0;
    const put = (i: number, k: number) => {
      vertices.set(profile.subarray((i * 4 + k) * 3, (i * 4 + k) * 3 + 3), o);
      o += 3;
    };
    for (let i = 0; i < n - 1; i++) {
      for (const [a, b] of pairs) {
        put(i, a);
        put(i, b);
        put(i + 1, a);
        put(i + 1, a);
        put(i, b);
        put(i + 1, b);
      }
    }
    return { vertices, vertsPerSegment };
  });
  const floor = deepest < 0 ? deepest * 1.25 : -1;
  if (period > 0) {
    if (!(vMin <= vMax)) vMin = vMax = 0;
    return { passes, bounds: { u: [-period / 2, period / 2], v: [vMin - 0.5, vMax + 0.5] }, period, floor };
  }
  const e = extent * 1.02 + 0.5;
  return { passes, bounds: { u: [-e, e], v: [-e, e] }, period: 0, floor };
}
