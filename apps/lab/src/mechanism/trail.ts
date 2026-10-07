import { fromSheet, type Toolpaths } from 'rosee';
import type { PlayheadAt } from '../playhead';

/** How far proud of the surface the cut is drawn, mm, so it never fights
 *  the stock for depth. */
const PROUD = 0.05;

/** Every pass's cut end to end, x, y, z per point in work-frame mm, laid on
 *  the uncut surface just proud of it: point `p` is playhead position `p`,
 *  so the cut so far is the first `cutTo(at) + 1` points. */
export function cutPath(t: Toolpaths): Float32Array {
  const n = t.samples;
  const count = t.passes.length * n + 1;
  const xyz = new Float32Array(count * 3);
  for (let position = 0; position < count; position++) {
    // A pass's last sample is the next one's first; read it from the pass that cut it.
    const pass = Math.min(Math.floor(position / n), t.passes.length - 1);
    const i = position - pass * n;
    const uvh = t.passes[pass].uvh;
    xyz.set(fromSheet(t.surface, uvh[i * 3], uvh[i * 3 + 1], PROUD), position * 3);
  }
  return xyz;
}

/** The point of `cutPath` the graver is at. */
export function cutTo(at: PlayheadAt, samples: number): number {
  return at.pass * samples + at.sample;
}
