import { chuckToWork, headstockToChuck, machineToHeadstock, rad, type Settings, TAU, type Toolpaths, wheelOf } from 'rosee';
import type { PlayheadAt } from '../playhead';

/** The last stretch of the cut, newest last: x, y per point in work-frame
 *  mm, and each point's age as a fraction of the stretch, 0 newest. */
export interface Trail {
  xy: Float32Array;
  age: Float32Array;
}

/** The last `turns` of cut up to the playhead, crossing back into earlier
 *  passes, as cut by a machine whose swing is `exaggerate` times the real
 *  one: where the drawn graver meets the drawn work. At 1 it is the toolpath. */
export function cutTrail(s: Settings, t: Toolpaths, at: PlayheadAt, exaggerate: number, turns = 1): Trail {
  const n = t.samples;
  const length = Math.round(turns * n);
  const end = at.pass * n + at.sample;
  const count = Math.min(length, end) + 1;
  const xy = new Float32Array(count * 2);
  const age = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const position = end - (count - 1) + k;
    // A pass's last sample is the next one's first; read it from the pass that cut it.
    const pass = Math.min(Math.floor(position / n), t.passes.length - 1);
    const i = position - pass * n;
    const path = t.passes[pass];
    const tip = machineToHeadstock([path.pass.radius, 0], s.pivotDistance, path.swing[i] * exaggerate);
    const [x, y] = chuckToWork(headstockToChuck(tip, (i / n) * TAU, rad(path.pass.index)), path.slide[i], wheelOf(s.chuck, path.pass));
    xy[k * 2] = x;
    xy[k * 2 + 1] = y;
    age[k] = (count - 1 - k) / length;
  }
  return { xy, age };
}
