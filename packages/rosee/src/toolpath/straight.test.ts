import { describe, expect, it } from 'vitest';
import type { Job } from '../job/job';
import type { Settings } from './settings';
import { computeToolpaths } from './toolpath';

const job = (over: Partial<Job> = {}): Job => ({
  from: 5,
  to: 5,
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

const settings = (amplitude: number, over: Partial<Settings> = {}): Settings => ({
  engine: { kind: 'straight', stroke: 30 },
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude } },
  rubber: { shape: 'round', radius: 0 },
  pivotDistance: 1e5,
  pump: null,
  chuck: null,
  surface: { kind: 'flat' },
  cutter: { vAngle: 90, tipFlat: 0 },
  job: job(),
  samplesPerTurn: 720,
  ...over,
});

describe('straight-line engine', () => {
  it('cuts a round rosette as a straight line the length of the stroke', () => {
    const t = computeToolpaths(settings(0));
    const p = t.passes[0];
    for (let i = 0; i <= t.samples; i++) {
      expect(p.xyz[i * 3]).toBeCloseTo(5, 6);
      expect(p.xyz[i * 3 + 1]).toBeCloseTo(-30 * (i / t.samples - 0.5), 5);
      expect(p.slide[i]).toBeCloseTo(30 * (i / t.samples - 0.5), 5);
    }
  });

  it('cuts a lobed rosette as a wave, a lobe every stroke over the lobe count', () => {
    const t = computeToolpaths(settings(1.5));
    const p = t.passes[0];
    const xs = Array.from({ length: t.samples + 1 }, (_, i) => p.xyz[i * 3]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(3, 2);
    const lobe = t.samples / 12;
    for (let i = 0; i + lobe <= t.samples; i += 7) expect(xs[i + lobe]).toBeCloseTo(xs[i], 3);
  });

  it('opens the V across the stroke, without turning with the rosette', () => {
    const p = computeToolpaths(settings(0)).passes[0];
    for (const a of p.across) expect(Math.abs(Math.cos(a))).toBeCloseTo(1, 6);
  });

  it('turns the rows with the division plate', () => {
    const t = computeToolpaths(settings(1, { job: job({ indexCount: 4 }) }));
    const [a, b] = [t.passes[0], t.passes[1]];
    for (let i = 0; i <= t.samples; i += 13) {
      // A quarter turn: (x, y) → (−y, x).
      expect(b.xyz[i * 3]).toBeCloseTo(-a.xyz[i * 3 + 1], 4);
      expect(b.xyz[i * 3 + 1]).toBeCloseTo(a.xyz[i * 3], 4);
    }
  });

  it('refuses a curved surface, a chuck or no stroke', () => {
    expect(() => computeToolpaths(settings(0, { surface: { kind: 'cylinder', radius: 10, length: 20 } }))).toThrow(/flat face/);
    expect(() => computeToolpaths(settings(0, { chuck: { kind: 'eccentric', eccentricity: 5, wheel: 0 } }))).toThrow(/no chuck/);
    expect(() => computeToolpaths(settings(0, { engine: { kind: 'straight', stroke: 0 } }))).toThrow(/stroke/);
  });
});
