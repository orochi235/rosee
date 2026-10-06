import { describe, expect, it } from 'vitest';
import { expandJob, type Job, passCount } from './job';

const base: Job = { from: 10, to: 12, step: 0.5, depth: 0.05, phaseStep: 15, phaseGroup: 1, pumpPhaseStep: 0, indexCount: 1, wheelCount: 1, eccentricityStep: 0 };

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

  it('rejects a program that cannot step or repeat', () => {
    expect(() => expandJob({ ...base, step: 0 })).toThrow(/step/);
    expect(() => expandJob({ ...base, step: -0.5 })).toThrow(/step/);
    expect(() => expandJob({ ...base, phaseGroup: 0 })).toThrow(/phaseGroup/);
    expect(() => expandJob({ ...base, indexCount: 0 })).toThrow(/indexCount/);
    expect(() => expandJob({ ...base, indexCount: 2.5 })).toThrow(/indexCount/);
  });

  it('allows a zero step when there is nowhere to go', () => {
    expect(expandJob({ ...base, from: 10, to: 10, step: 0 }).map((p) => p.radius)).toEqual([10]);
  });

  it('counts the passes it would expand to', () => {
    for (const j of [base, { ...base, indexCount: 3 }, { ...base, from: 12, to: 12 }, { ...base, wheelCount: 4, indexCount: 2 }])
      expect(passCount(j)).toBe(expandJob(j).length);
  });

  it('repeats the sweep at each wheel division, inside each index division', () => {
    const passes = expandJob({ ...base, from: 10, to: 10, indexCount: 2, wheelCount: 3 });
    expect(passes.map((p) => [p.index, p.wheel])).toEqual([
      [0, 0],
      [0, 120],
      [0, 240],
      [180, 0],
      [180, 120],
      [180, 240],
    ]);
  });

  it('steps the eccentricity every pass, starting again at each division', () => {
    const passes = expandJob({ ...base, eccentricityStep: 0.5, wheelCount: 2 });
    expect(passes.map((p) => p.eccentricity)).toEqual([0, 0.5, 1, 1.5, 2, 0, 0.5, 1, 1.5, 2]);
  });

  it('rejects wheel counts that are not whole and positive, and a non-finite eccentricity step', () => {
    expect(() => expandJob({ ...base, wheelCount: 0 })).toThrow(/wheelCount/);
    expect(() => expandJob({ ...base, wheelCount: 1.5 })).toThrow(/wheelCount/);
    expect(() => expandJob({ ...base, eccentricityStep: Number.NaN })).toThrow(/eccentricityStep/);
  });
});
