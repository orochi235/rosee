import { deg, TAU } from 'rosee';

/** The playhead resolved against a cut: `pass` and `sample` are clamped to
 *  the toolpaths, `angle` is the spindle's in radians and `degrees` the same,
 *  and `label` names the pass for display, counting from 1. */
export interface PlayheadAt {
  pass: number;
  sample: number;
  angle: number;
  degrees: number;
  label: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** `position` counts samples from the first pass's start, `pass * samples +
 *  sample`; the end is every pass cut in full. */
export function at(position: number, samples: number, passes: number): PlayheadAt {
  const pass = clamp(Math.floor(position / samples), 0, passes - 1);
  const sample = clamp(Math.round(position - pass * samples), 0, samples);
  const angle = (sample / samples) * TAU;
  return { pass, sample, angle, degrees: deg(angle), label: `pass ${pass + 1}/${passes}` };
}
