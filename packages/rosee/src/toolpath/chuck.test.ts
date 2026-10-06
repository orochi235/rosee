import { describe, expect, it } from 'vitest';
import type { Job } from '../job/job';
import type { Chuck } from '../machine/chuck';
import type { Settings } from './settings';
import { computeToolpaths } from './toolpath';

const job = (over: Partial<Job> = {}): Job => ({
  from: 5,
  to: 5,
  step: 1,
  depth: 0.05,
  phaseStep: 0,
  phaseGroup: 1,
  pumpPhaseStep: 0,
  indexCount: 1,
  wheelCount: 1,
  eccentricityStep: 0,
  ...over,
});

const round = (chuck: Chuck | null, over: Partial<Job> = {}): Settings => ({
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } },
  rubber: { shape: 'round', radius: 0 },
  pivotDistance: 150,
  pump: null,
  chuck,
  cutter: { vAngle: 90, tipFlat: 0 },
  job: job(over),
  samplesPerTurn: 360,
});

const points = (xyz: Float32Array) => Array.from({ length: xyz.length / 3 }, (_, i) => [xyz[i * 3], xyz[i * 3 + 1]]);

describe('chucks', () => {
  it('eccentric: a circle of the cutter radius centered e off the work center', () => {
    const path = computeToolpaths(round({ kind: 'eccentric', eccentricity: 8, wheel: 0 })).passes[0];
    for (const [x, y] of points(path.xyz)) expect(Math.hypot(x + 8, y)).toBeCloseTo(5, 4);
    expect([...path.slide].every((s) => s === 8)).toBe(true);
  });

  it('elliptical: semi-axes |r − e| along the slide and r across it', () => {
    for (const [r, e] of [
      [10, 4],
      [2, 4],
    ]) {
      const chuck: Chuck = { kind: 'elliptical', eccentricity: e, ring: 0, wheel: 0 };
      const path = computeToolpaths(round(chuck, { from: r, to: r })).passes[0];
      for (const [x, y] of points(path.xyz)) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect((x / (r - e)) ** 2 + (y / r) ** 2).toBeCloseTo(1, 3);
      }
    }
  });

  it('elliptical with the cutter on center: a line 2e long', () => {
    const path = computeToolpaths(round({ kind: 'elliptical', eccentricity: 4, ring: 0, wheel: 0 }, { from: 0, to: 0 })).passes[0];
    const pts = points(path.xyz);
    for (const [, y] of pts) expect(Math.abs(y)).toBeLessThan(1e-4);
    const xs = pts.map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(-4, 4);
    expect(Math.max(...xs)).toBeCloseTo(4, 4);
  });

  it('a full turn of the wheel cuts what wheel 0 cuts', () => {
    const a = computeToolpaths(round({ kind: 'eccentric', eccentricity: 8, wheel: 0 })).passes[0].xyz;
    const b = computeToolpaths(round({ kind: 'eccentric', eccentricity: 8, wheel: 360 })).passes[0].xyz;
    for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i], 4);
  });

  it('each wheel division is the first turned back by its wheel angle', () => {
    const { passes } = computeToolpaths(round({ kind: 'eccentric', eccentricity: 8, wheel: 0 }, { wheelCount: 4 }));
    const first = points(passes[0].xyz);
    points(passes[1].xyz).forEach(([x, y], i) => {
      // Wheel +90° turns the work frame by −90°; turning back by +90° recovers the first.
      expect(-y).toBeCloseTo(first[i][0], 4);
      expect(x).toBeCloseTo(first[i][1], 4);
    });
  });

  it('opens the V across the machine x axis, wheel included', () => {
    const path = computeToolpaths(round({ kind: 'eccentric', eccentricity: 8, wheel: 30 })).passes[0];
    const i = 90;
    const spindle = (i / 360) * 2 * Math.PI;
    expect(path.across[i]).toBeCloseTo(-spindle - path.swing[i] - Math.PI / 6, 5);
  });

  it('refuses wheel divisions or an eccentricity step with no chuck', () => {
    expect(() => computeToolpaths(round(null, { wheelCount: 2 }))).toThrow(/chuck/);
    expect(() => computeToolpaths(round(null, { eccentricityStep: 0.5 }))).toThrow(/chuck/);
  });

  it('cuts the same as before chucks with no chuck', () => {
    const path = computeToolpaths(round(null)).passes[0];
    for (const [x, y] of points(path.xyz)) expect(Math.hypot(x, y)).toBeCloseTo(5, 5);
    expect([...path.slide].every((s) => s === 0)).toBe(true);
  });
});
