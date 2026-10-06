import { describe, expect, it } from 'vitest';
import { expandJob, type Job } from './job';

const base: Job = { from: 10, to: 12, step: 0.5, depth: 0.05, phaseStep: 15, phaseGroup: 1, pumpPhaseStep: 0, indexCount: 1 };

describe('expandJob', () => {
  it('steps the radius from `from` to `to` inclusive', () => {
    expect(expandJob(base).map((p) => p.radius)).toEqual([10, 10.5, 11, 11.5, 12]);
  });

  it('steps inward when `to` is below `from`', () => {
    expect(expandJob({ ...base, from: 12, to: 11 }).map((p) => p.radius)).toEqual([12, 11.5, 11]);
  });

  it('phases every pass, or every group of passes', () => {
    expect(expandJob(base).map((p) => p.phase)).toEqual([0, 15, 30, 45, 60]);
    expect(expandJob({ ...base, phaseGroup: 2 }).map((p) => p.phase)).toEqual([0, 0, 15, 15, 30]);
  });

  it('repeats the sweep at each division', () => {
    const passes = expandJob({ ...base, indexCount: 4 });
    expect(passes).toHaveLength(20);
    expect([...new Set(passes.map((p) => p.index))]).toEqual([0, 90, 180, 270]);
  });
});
