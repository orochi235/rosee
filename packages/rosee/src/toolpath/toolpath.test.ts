import { describe, expect, it } from 'vitest';
import type { Job } from '../job/job';
import type { Settings } from './settings';
import { computeToolpaths } from './toolpath';

const job = (over: Partial<Job> = {}): Job => ({
  from: 20,
  to: 20,
  step: 1,
  depth: 0.05,
  phaseStep: 0,
  phaseGroup: 1,
  pumpPhaseStep: 0,
  indexCount: 1,
  ...over,
});

const settings = (over: Partial<Settings> = {}): Settings => ({
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } },
  rubber: { shape: 'round', radius: 0 },
  pivotDistance: 1e5,
  pump: null,
  cutter: { vAngle: 90, tipFlat: 0 },
  job: job(),
  samplesPerTurn: 720,
  ...over,
});

/** Worst distance from the ideal r = R + a·cos(n(ψ − phase)). */
function idealError(s: Settings, phaseDeg = 0): number {
  const path = computeToolpaths(s).passes[0];
  const phase = (phaseDeg * Math.PI) / 180;
  let worst = 0;
  for (let i = 0; i < path.xyz.length / 3; i++) {
    const x = path.xyz[i * 3];
    const y = path.xyz[i * 3 + 1];
    const ideal = 20 + 1.5 * Math.cos(12 * (Math.atan2(y, x) - phase));
    worst = Math.max(worst, Math.abs(Math.hypot(x, y) - ideal));
  }
  return worst;
}

describe('computeToolpaths', () => {
  it('cuts a circle with a round rosette', () => {
    const s = settings({ rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } }, pivotDistance: 150 });
    const path = computeToolpaths(s).passes[0];
    for (let i = 0; i < path.xyz.length / 3; i++) {
      expect(Math.hypot(path.xyz[i * 3], path.xyz[i * 3 + 1])).toBeCloseTo(20, 5);
    }
  });

  it('matches the ideal formula with a knife edge and a very long arm', () => {
    expect(idealError(settings())).toBeLessThan(2e-4);
    expect(idealError(settings({ job: job({ phaseStep: 10, from: 20, to: 20 }) }))).toBeLessThan(2e-4);
  });

  it('rotates the lobes by the phase', () => {
    const s = settings({ job: job({ from: 20, to: 21, step: 1, phaseStep: 7 }) });
    const second = { ...s, job: job({ phaseStep: 0 }) };
    expect(idealError(second, 0)).toBeLessThan(2e-4);
    const path = computeToolpaths(s).passes[1];
    expect(path.pass.phase).toBe(7);
    let worst = 0;
    for (let i = 0; i < path.xyz.length / 3; i++) {
      const x = path.xyz[i * 3];
      const y = path.xyz[i * 3 + 1];
      const ideal = 21 + 1.5 * Math.cos(12 * (Math.atan2(y, x) - (7 * Math.PI) / 180));
      worst = Math.max(worst, Math.abs(Math.hypot(x, y) - ideal));
    }
    expect(worst).toBeLessThan(2e-4);
  });

  it('distorts more the shorter the pivot arm', () => {
    const near = idealError(settings({ pivotDistance: 60 }));
    const far = idealError(settings({ pivotDistance: 600 }));
    expect(near).toBeGreaterThan(1e-3);
    expect(near).toBeGreaterThan(5 * far);
  });

  it('cuts the same path a whole lobe of phase later', () => {
    const a = computeToolpaths(settings()).passes[0].xyz;
    const b = computeToolpaths(settings({ job: job({ phaseStep: 30, from: 20, to: 21 }) })).passes[1].xyz;
    const a21 = computeToolpaths(settings({ job: job({ from: 21, to: 21 }) })).passes[0].xyz;
    expect(a.length).toBe(b.length);
    for (let i = 0; i < b.length; i++) expect(Math.abs(b[i] - a21[i])).toBeLessThan(1e-4);
  });

  it('turns the pattern by the index', () => {
    const s = settings({ pivotDistance: 150, job: job({ indexCount: 4 }) });
    const [p0, p1] = computeToolpaths(s).passes;
    expect(p1.pass.index).toBe(90);
    for (let i = 0; i < p0.xyz.length / 3; i++) {
      const [x, y] = [p0.xyz[i * 3], p0.xyz[i * 3 + 1]];
      expect(p1.xyz[i * 3]).toBeCloseTo(-y, 4);
      expect(p1.xyz[i * 3 + 1]).toBeCloseTo(x, 4);
    }
  });

  it('cuts at constant depth without a pump', () => {
    const path = computeToolpaths(settings()).passes[0];
    for (let i = 2; i < path.xyz.length; i += 3) expect(path.xyz[i]).toBeCloseTo(-0.05, 7);
  });

  it('pumps the depth by gain × the pumping rosette\'s wave', () => {
    const s = settings({
      pump: {
        rosette: { radius: 30, wave: { kind: 'sine', lobes: 6, amplitude: 0.02 } },
        rubber: { shape: 'round', radius: 0 },
        gain: 2,
      },
    });
    const path = computeToolpaths(s).passes[0];
    const z = [...path.xyz].filter((_, i) => i % 3 === 2);
    expect(Math.min(...z)).toBeCloseTo(-0.09, 4);
    expect(Math.max(...z)).toBeCloseTo(-0.01, 4);
  });

  it('records the rubber touching where the rosette faces it', () => {
    const path = computeToolpaths(settings()).passes[0];
    const quarter = path.contact.length / 4;
    expect(path.contact[0]).toBeCloseTo(0, 3);
    expect(((path.contact[Math.floor(quarter)] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toBeCloseTo(
      (3 * Math.PI) / 2,
      2,
    );
  });
});
