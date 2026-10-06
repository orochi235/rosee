import { describe, expect, it } from 'vitest';
import { drawnLobe, flatLobe, petalLobe, scallopLobe, sineLobe } from './profile';

describe('lobe profiles', () => {
  const kinds = { sine: sineLobe, flat: flatLobe(0.4), petal: petalLobe(2), scallop: scallopLobe };
  for (const [name, p] of Object.entries(kinds)) {
    it(`${name} peaks at u=0 and bottoms at u=0.5`, () => {
      expect(p(0)).toBeCloseTo(1, 9);
      expect(p(0.5)).toBeCloseTo(-1, 9);
    });
    it(`${name} is symmetric about the peak`, () => {
      for (const u of [0.05, 0.13, 0.31, 0.44]) expect(p(u)).toBeCloseTo(p(1 - u), 9);
    });
  }

  it('flat holds its top across the flat fraction', () => {
    const p = flatLobe(0.4);
    expect(p(0.09)).toBe(1);
    expect(p(0.5 - 0.09)).toBe(-1);
  });

  it('drawn passes through its control points and wraps without a seam', () => {
    const p = drawnLobe([
      { u: 0, p: 1 },
      { u: 0.3, p: -0.2 },
      { u: 0.5, p: -1 },
      { u: 0.7, p: -0.2 },
    ]);
    expect(p(0)).toBeCloseTo(1, 9);
    expect(p(0.3)).toBeCloseTo(-0.2, 9);
    expect(p(0.5)).toBeCloseTo(-1, 9);
    expect(p(0.9999999)).toBeCloseTo(p(0), 4);
  });

  it('drawn never overshoots its control points', () => {
    const p = drawnLobe([
      { u: 0, p: 1 },
      { u: 0.05, p: 1 },
      { u: 0.5, p: -1 },
    ]);
    for (let i = 0; i < 1000; i++) {
      expect(p(i / 1000)).toBeLessThanOrEqual(1);
      expect(p(i / 1000)).toBeGreaterThanOrEqual(-1);
    }
    expect(p(0.025)).toBe(1);
  });

  it('drawn wraps when the first control point is past zero', () => {
    const p = drawnLobe([
      { u: 0.1, p: 1 },
      { u: 0.6, p: -1 },
      { u: 0.8, p: 0.5 },
    ]);
    expect(p(0.1)).toBeCloseTo(1, 12);
    expect(p(0.05)).toBeCloseTo(p(1.05 - 1), 12);
    expect(p(0.9999999)).toBeCloseTo(p(0), 5);
    for (let i = 0; i < 100; i++) expect(Math.abs(p(i / 100))).toBeLessThanOrEqual(1);
  });
});
