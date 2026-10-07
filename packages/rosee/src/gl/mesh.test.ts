import { describe, expect, it } from 'vitest';
import { straightGroove } from './fixtures/straightGroove';
import { carveMesh } from './mesh';

describe('carveMesh', () => {
  it('builds two flank quads per segment for a sharp graver', () => {
    const m = carveMesh(straightGroove(0.1), { vAngle: 90, tipFlat: 0 });
    expect(m.passes[0].vertsPerSegment).toBe(12);
    expect(m.passes[0].vertices.length).toBe(20 * 12 * 3);
  });

  it('adds a tip quad for a graver with a flat', () => {
    expect(carveMesh(straightGroove(0.1), { vAngle: 90, tipFlat: 0.02 }).passes[0].vertsPerSegment).toBe(18);
  });

  it('puts the flanks where the V meets the surface', () => {
    const v = carveMesh(straightGroove(0.1), { vAngle: 90, tipFlat: 0 }).passes[0].vertices;
    const ys = new Set<number>();
    const hs = new Set<number>();
    for (let i = 0; i < v.length; i += 3) {
      ys.add(Math.round(v[i + 1] * 1e6) / 1e6);
      hs.add(Math.round(v[i + 2] * 1e6) / 1e6);
    }
    expect([...ys].sort((a, b) => a - b)).toEqual([-0.1, 0, 0.1]);
    expect([...hs].sort((a, b) => a - b)).toEqual([-0.1, 0]);
  });

  it('sizes the domain to hold every cut and leaves room below the deepest', () => {
    const m = carveMesh(straightGroove(0.1), { vAngle: 90, tipFlat: 0 });
    expect(m.bounds.u[1]).toBeGreaterThan(5);
    expect(m.bounds.u).toEqual([-m.bounds.v[1], m.bounds.v[1]]);
    expect(m.period).toBe(0);
    expect(m.floor).toBeCloseTo(-0.125, 6);
  });
});
