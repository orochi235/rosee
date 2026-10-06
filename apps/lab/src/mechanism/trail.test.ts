import { computeToolpaths, PRESETS } from 'rosee';
import { describe, expect, it } from 'vitest';
import { at } from '../playhead';
import { cutTrail } from './trail';

describe('cutTrail', () => {
  const s = { ...PRESETS.wheel, samplesPerTurn: 64 };
  const t = computeToolpaths(s);
  const n = 64;

  it('is the toolpath itself when the swing is not magnified, across a pass boundary', () => {
    const trail = cutTrail(s, t, at(3 * n + 20, n, t.passes.length), 1);
    expect(trail.age.length).toBe(n + 1);
    for (let k = 0; k <= n; k++) {
      const position = 2 * n + 20 + k;
      const pass = Math.floor(position / n);
      const i = position - pass * n;
      const xyz = t.passes[pass].xyz;
      expect(trail.xy[k * 2]).toBeCloseTo(xyz[i * 3], 4);
      expect(trail.xy[k * 2 + 1]).toBeCloseTo(xyz[i * 3 + 1], 4);
    }
  });

  it('ages from 1 at the far end to 0 at the graver', () => {
    const { age } = cutTrail(s, t, at(5 * n, n, t.passes.length), 3, 1);
    expect(age[0]).toBeCloseTo(1, 6);
    expect(age[age.length - 1]).toBe(0);
  });

  it('starts short at the start of the cut', () => {
    expect(cutTrail(s, t, at(10, n, t.passes.length), 1).age.length).toBe(11);
  });
});
