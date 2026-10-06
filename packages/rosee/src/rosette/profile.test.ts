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
});
