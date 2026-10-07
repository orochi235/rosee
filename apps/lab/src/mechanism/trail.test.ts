import { computeToolpaths, PRESETS } from 'rosee';
import { describe, expect, it } from 'vitest';
import { at } from '../playhead';
import { cutPath, cutTo } from './trail';

describe('cutPath', () => {
  const s = { ...PRESETS.wheel, samplesPerTurn: 64 };
  const t = computeToolpaths(s);
  const n = 64;
  const xyz = cutPath(t);

  it('is every pass of the toolpath end to end, one point per playhead position', () => {
    expect(xyz.length / 3).toBe(t.passes.length * n + 1);
    for (const position of [0, 20, n - 1, n, n + 1, 3 * n + 20, t.passes.length * n]) {
      const pass = Math.min(Math.floor(position / n), t.passes.length - 1);
      const i = position - pass * n;
      expect(xyz[position * 3]).toBeCloseTo(t.passes[pass].xyz[i * 3], 4);
      expect(xyz[position * 3 + 1]).toBeCloseTo(t.passes[pass].xyz[i * 3 + 1], 4);
      expect(xyz[position * 3 + 2]).toBeCloseTo(0.05, 6);
    }
  });

  it('lays the cut on a barrel just proud of it', () => {
    const b = computeToolpaths({ ...PRESETS.barrel, samplesPerTurn: 64 });
    const path = cutPath(b);
    for (let p = 0; p < path.length / 3; p += 17) expect(Math.hypot(path[p * 3], path[p * 3 + 1])).toBeCloseTo(10.05, 4);
  });

  it('puts the playhead at its own point', () => {
    expect(cutTo(at(3 * n + 20, n, t.passes.length), n)).toBe(3 * n + 20);
  });
});
