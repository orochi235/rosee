import { computeToolpaths, PRESETS } from 'rosee';
import { describe, expect, it } from 'vitest';
import { at } from '../playhead';
import { cutPath, cutTo } from './trail';

describe('cutPath', () => {
  const s = { ...PRESETS.wheel, samplesPerTurn: 64 };
  const t = computeToolpaths(s);
  const n = 64;
  const xy = cutPath(t);

  it('is every pass of the toolpath end to end, one point per playhead position', () => {
    expect(xy.length / 2).toBe(t.passes.length * n + 1);
    for (const position of [0, 20, n - 1, n, n + 1, 3 * n + 20, t.passes.length * n]) {
      const pass = Math.min(Math.floor(position / n), t.passes.length - 1);
      const i = position - pass * n;
      expect(xy[position * 2]).toBeCloseTo(t.passes[pass].xyz[i * 3], 4);
      expect(xy[position * 2 + 1]).toBeCloseTo(t.passes[pass].xyz[i * 3 + 1], 4);
    }
  });

  it('puts the playhead at its own point', () => {
    expect(cutTo(at(3 * n + 20, n, t.passes.length), n)).toBe(3 * n + 20);
  });
});
