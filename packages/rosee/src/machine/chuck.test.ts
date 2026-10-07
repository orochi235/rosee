import { describe, expect, it } from 'vitest';
import type { Pass } from '../job/job';
import { slideAt } from './chuck';
import { chuckToWork, workToChuck } from './pose';

const pass: Pass = { at: 0, depth: 0, phase: 0, pumpPhase: 0, index: 0, wheel: 0, eccentricity: 0 };

describe('chuck frames', () => {
  it('round-trips chuck ↔ work', () => {
    const w = chuckToWork([3, -2], 1.5, 0.7);
    const c = workToChuck(w, 1.5, 0.7);
    expect(c[0]).toBeCloseTo(3, 12);
    expect(c[1]).toBeCloseTo(-2, 12);
  });

  it('puts the work center at the slide offset', () => {
    expect(workToChuck([0, 0], 4, 1.1)).toEqual([4, 0]);
  });
});

describe('slideAt', () => {
  it('holds an eccentric chuck at its eccentricity plus the pass step', () => {
    expect(slideAt({ kind: 'eccentric', eccentricity: 8, wheel: 0 }, { ...pass, eccentricity: 0.5 }, 2)).toBe(8.5);
  });

  it('drives an elliptical chuck by the ring: e·cos(slide angle − ring)', () => {
    const chuck = { kind: 'elliptical', eccentricity: 4, ring: 30, wheel: 0 } as const;
    for (const a of [0, 0.4, 2, 5]) expect(slideAt(chuck, pass, a)).toBeCloseTo(4 * Math.cos(a - Math.PI / 6), 12);
  });
});
