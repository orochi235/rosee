import { describe, expect, it } from 'vitest';
import { at } from './playhead';

describe('at', () => {
  it('splits a position into a pass and a sample', () => {
    expect(at(0, 100, 3)).toMatchObject({ pass: 0, sample: 0, degrees: 0, label: 'pass 1/3' });
    expect(at(250, 100, 3)).toMatchObject({ pass: 2, sample: 50, angle: Math.PI, label: 'pass 3/3' });
    expect(at(250, 100, 3).degrees).toBeCloseTo(180, 9);
  });

  it('holds the end as the last pass cut in full', () => {
    expect(at(300, 100, 3)).toMatchObject({ pass: 2, sample: 100 });
  });

  it('clamps a position left over from a longer cut', () => {
    expect(at(90_000, 100, 3)).toMatchObject({ pass: 2, sample: 100, label: 'pass 3/3' });
    expect(at(-5, 100, 3)).toMatchObject({ pass: 0, sample: 0 });
  });
});
