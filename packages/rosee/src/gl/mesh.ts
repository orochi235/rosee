import { rad } from '../angle';
import type { Cutter } from '../cutter/cutter';
import { flatFace, type Surface } from '../surface/surface';
import type { Toolpaths } from '../toolpath/toolpath';

/** One pass as triangles (u, v, h per vertex, mm), laid out segment by
 *  segment so a prefix of the buffer is the pass cut up to a sample. */
export interface PassMesh {
  vertices: Float32Array;
  vertsPerSegment: number;
}

export interface CarveMesh {
  passes: PassMesh[];
  /** Half-width of the square carve domain, centered on the work axis, mm. */
  extent: number;
  /** The deepest height the carve represents, mm (negative). */
  floor: number;
}

/** The graver swept along each pass. At every sample the cutter is a V
 *  profile across `across`; consecutive profiles are joined by quads, which
 *  is exact for a V moved without turning and close when it turns slowly. */
export function carveMesh(t: Toolpaths, cutter: Cutter, surface: Surface = flatFace): CarveMesh {
  const slope = Math.tan(rad(cutter.vAngle) / 2);
  const flat = cutter.tipFlat / 2;
  const quads = flat > 0 ? 3 : 2;
  const vertsPerSegment = quads * 6;
  let extent = 0;
  let deepest = 0;
  const passes = t.passes.map((p): PassMesh => {
    const n = p.across.length;
    // Per sample, the profile's corners: surface-left, tip-left, tip-right, surface-right.
    const profile = new Float32Array(n * 4 * 3);
    for (let i = 0; i < n; i++) {
      const x = p.xyz[i * 3];
      const y = p.xyz[i * 3 + 1];
      const z = Math.min(p.xyz[i * 3 + 2], 0);
      const ax = Math.cos(p.across[i]);
      const ay = Math.sin(p.across[i]);
      const half = flat - z * slope;
      const corners: [number, number][] = [
        [-half, 0],
        [-flat, z],
        [flat, z],
        [half, 0],
      ];
      corners.forEach(([off, h], k) => {
        const [u, v, hh] = surface.toDomain(x + ax * off, y + ay * off, h);
        profile.set([u, v, hh], (i * 4 + k) * 3);
        extent = Math.max(extent, Math.abs(u), Math.abs(v));
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
  return { passes, extent: extent * 1.02 + 0.5, floor: deepest < 0 ? deepest * 1.25 : -1 };
}
