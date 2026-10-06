import type { Toolpaths } from 'rosee';
import type { PlayheadAt } from '../playhead';

/** Every pass's cut end to end, x, y per point in work-frame mm: point `p` is
 *  playhead position `p`, so the cut so far is the first `cutTo(at) + 1` points. */
export function cutPath(t: Toolpaths): Float32Array {
  const n = t.samples;
  const count = t.passes.length * n + 1;
  const xy = new Float32Array(count * 2);
  for (let position = 0; position < count; position++) {
    // A pass's last sample is the next one's first; read it from the pass that cut it.
    const pass = Math.min(Math.floor(position / n), t.passes.length - 1);
    const i = position - pass * n;
    const xyz = t.passes[pass].xyz;
    xy[position * 2] = xyz[i * 3];
    xy[position * 2 + 1] = xyz[i * 3 + 1];
  }
  return xy;
}

/** The point of `cutPath` the graver is at. */
export function cutTo(at: PlayheadAt, samples: number): number {
  return at.pass * samples + at.sample;
}
