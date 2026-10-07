import { describe, expect, it } from 'vitest';
import { fromSheet, graverAt, reachOf, type Surface, sheetPeriod, toSheet } from './surface';

const SURFACES: Surface[] = [
  { kind: 'flat' },
  { kind: 'cylinder', radius: 10, length: 24 },
  { kind: 'dome', radius: 30, rim: 20 },
];

describe.each(SURFACES)('$kind', (s) => {
  it('puts the graver at its depth below the surface', () => {
    for (const at of [0.5, 4, 12]) {
      const { tip } = graverAt(s, at, 0.2);
      expect(toSheet(s, ...tip)[2]).toBeCloseTo(-0.2, 9);
    }
  });

  it('unrolls and rolls back up to the same point', () => {
    for (const [u, v, h] of [[1, 2, -0.1], [-6, 3, 0], [4, -9, -0.3]]) {
      const p = fromSheet(s, u, v, h);
      const back = toSheet(s, ...p);
      expect(back[0]).toBeCloseTo(u, 9);
      expect(back[1]).toBeCloseTo(v, 9);
      expect(back[2]).toBeCloseTo(h, 9);
    }
  });

  it('points the graver square into the surface', () => {
    const { tip, points } = graverAt(s, 6, 0.2);
    const deeper = toSheet(s, tip[0] + 0.01 * points[0], tip[1] + 0.01 * points[1], tip[2] + 0.01 * points[2]);
    expect(deeper[2]).toBeCloseTo(-0.21, 9);
  });

  it('opens the V across the surface, square to where the graver points', () => {
    const { tip, opens } = graverAt(s, 6, 0.2);
    const step = 1e-4;
    const here = toSheet(s, ...tip);
    const along = toSheet(s, tip[0] + step * opens[0], tip[1] + step * opens[1], tip[2] + step * opens[2]);
    expect(Math.abs(along[2] - here[2])).toBeLessThan(1e-7);
    expect(Math.hypot(along[0] - here[0], along[1] - here[1])).toBeGreaterThan(step * 0.5);
  });
});

describe('surfaces', () => {
  it('sets the graver along a barrel by the distance from the face', () => {
    const s: Surface = { kind: 'cylinder', radius: 10, length: 24 };
    const [u, v] = toSheet(s, ...graverAt(s, 7, 0.1).tip);
    expect(u).toBeCloseTo(0, 9);
    expect(v).toBeCloseTo(7, 9);
  });

  it('sets the graver on a dome by the arc from its pole', () => {
    const s: Surface = { kind: 'dome', radius: 30, rim: 20 };
    const [u, v] = toSheet(s, ...graverAt(s, 9, 0.1).tip);
    expect(Math.hypot(u, v)).toBeCloseTo(9, 9);
  });

  it('wraps only the barrel, by its circumference', () => {
    expect(sheetPeriod({ kind: 'cylinder', radius: 10, length: 24 })).toBeCloseTo(20 * Math.PI, 12);
    expect(sheetPeriod({ kind: 'dome', radius: 30, rim: 20 })).toBe(0);
  });

  it('reaches to the barrel end and the dome rim', () => {
    expect(reachOf({ kind: 'cylinder', radius: 10, length: 24 })).toBe(24);
    expect(reachOf({ kind: 'dome', radius: 30, rim: 30 })).toBeCloseTo(15 * Math.PI, 9);
  });
});
