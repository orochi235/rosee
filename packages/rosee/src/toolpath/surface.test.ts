import { describe, expect, it } from 'vitest';
import type { Job } from '../job/job';
import { reachAt, contactTable } from '../contact/table';
import { sheetRuns } from './runs';
import type { Settings } from './settings';
import { computeToolpaths } from './toolpath';

const job = (over: Partial<Job> = {}): Job => ({
  from: 8,
  to: 8,
  step: 1,
  depth: 0.1,
  phaseStep: 0,
  phaseGroup: 1,
  pumpPhaseStep: 0,
  indexCount: 1,
  wheelCount: 1,
  eccentricityStep: 0,
  ...over,
});

const settings = (over: Partial<Settings> = {}): Settings => ({
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } },
  rubber: { shape: 'round', radius: 0 },
  engine: { kind: 'rose' },
  pivotDistance: 150,
  pump: null,
  chuck: null,
  surface: { kind: 'cylinder', radius: 10, length: 24 },
  cutter: { vAngle: 90, tipFlat: 0 },
  job: job(),
  samplesPerTurn: 360,
  ...over,
});

const samples = (uvh: Float32Array) => Array.from({ length: uvh.length / 3 }, (_, i) => [uvh[i * 3], uvh[i * 3 + 1], uvh[i * 3 + 2]]);

describe('surfaces in the toolpath', () => {
  it('cuts a round rosette as a ring round a barrel at its depth', () => {
    const path = computeToolpaths(settings()).passes[0];
    for (const [, v, h] of samples(path.uvh)) {
      expect(v).toBeCloseTo(8, 5);
      expect(h).toBeCloseTo(-0.1, 5);
    }
    const us = samples(path.uvh).map(([u]) => u);
    expect(Math.max(...us) - Math.min(...us)).toBeGreaterThan(19.9 * Math.PI);
  });

  it('turns rocking into depth on a barrel, leaving the ring where it was', () => {
    const s = settings({ rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0.05 } } });
    const hs = samples(computeToolpaths(s).passes[0].uvh).map(([, v, h]) => {
      expect(v).toBeCloseTo(8, 5);
      return h;
    });
    expect(Math.max(...hs) - Math.min(...hs)).toBeGreaterThan(0.09);
  });

  it('turns pumping into waves along a barrel', () => {
    const pump = { rosette: { radius: 30, wave: { kind: 'sine' as const, lobes: 9, amplitude: 1 } }, rubber: { shape: 'round' as const, radius: 0 }, gain: 0.5 };
    const t = computeToolpaths(settings({ pump }));
    const table = contactTable(pump.rosette, pump.rubber);
    const path = t.passes[0];
    for (let i = 0; i <= t.samples; i += 9) {
      const θ = (i / t.samples) * 2 * Math.PI;
      expect(path.uvh[i * 3 + 1]).toBeCloseTo(8 + 0.5 * (reachAt(table, -θ) - table.mean), 3);
      expect(path.uvh[i * 3 + 2]).toBeCloseTo(-0.1, 5);
    }
  });

  it('opens the V along the barrel', () => {
    const path = computeToolpaths(settings()).passes[0];
    for (const a of path.across) expect(Math.abs(Math.sin(a))).toBeCloseTo(1, 6);
  });

  it('breaks a pass round a barrel once, at its seam', () => {
    const path = computeToolpaths(settings()).passes[0];
    expect(sheetRuns(path.uvh, path.uvh.length / 3, 20 * Math.PI)).toHaveLength(2);
  });

  it('cuts a round rosette as a ring on a dome at its arc and depth', () => {
    const path = computeToolpaths(settings({ surface: { kind: 'dome', radius: 30, rim: 20 } })).passes[0];
    for (const [u, v, h] of samples(path.uvh)) {
      expect(Math.hypot(u, v)).toBeCloseTo(8, 4);
      expect(h).toBeCloseTo(-0.1, 5);
    }
  });

  it('cuts a face as before, its sheet the work frame', () => {
    const path = computeToolpaths(settings({ surface: { kind: 'flat' } })).passes[0];
    expect([...path.uvh]).toEqual([...path.xyz]);
  });

  it('refuses a dome rim past its radius', () => {
    expect(() => computeToolpaths(settings({ surface: { kind: 'dome', radius: 10, rim: 12 } }))).toThrow(/rim/);
  });
});
