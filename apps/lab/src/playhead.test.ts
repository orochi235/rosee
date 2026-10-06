import { describe, expect, it } from 'vitest';
import { at } from './playhead';

describe('at', () => {
  it('splits a position into a pass and a sample', () => {
    expect(at(0, 100, 3)).toEqual({ pass: 0, sample: 0 });
    expect(at(250, 100, 3)).toEqual({ pass: 2, sample: 50 });
  });

  it('holds the end as the last pass cut in full', () => {
    expect(at(300, 100, 3)).toEqual({ pass: 2, sample: 100 });
  });
});
