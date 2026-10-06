import { describe, expect, it } from 'vitest';
import { TAU } from '../angle';
import type { Job } from '../job/job';
import { machineToHeadstock, chuckToHeadstock } from '../machine/pose';
import { radiusAt } from '../rosette/rosette';
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
  wheelCount: 1,
  eccentricityStep: 0,
  ...over,
});

const settings = (over: Partial<Settings> = {}): Settings => ({
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } },
  rubber: { shape: 'round', radius: 0 },
  pivotDistance: 1e5,
  pump: null,
  chuck: null,
  cutter: { vAngle: 90, tipFlat: 0 },
  job: job(),
  samplesPerTurn: 720,
  ...over,
});

/** Worst distance from the ideal r = R + a·cos(n(ψ − phase)) over one pass. */
function idealError(s: Settings, pass = 0): number {
  const path = computeToolpaths(s).passes[pass];
  const phase = (path.pass.phase * Math.PI) / 180;
  let worst = 0;
  for (let i = 0; i < path.xyz.length / 3; i++) {
    const x = path.xyz[i * 3];
    const y = path.xyz[i * 3 + 1];
    const ideal = path.pass.radius + 1.5 * Math.cos(12 * (Math.atan2(y, x) - phase));
    worst = Math.max(worst, Math.abs(Math.hypot(x, y) - ideal));
  }
  return worst;
}

/** Distance from `a` to the nearest multiple of `period`. */
const offPeriod = (a: number, period: number): number => Math.abs(a - period * Math.round(a / period));

/** Shortest distance between two angles. */
const angleBetween = (a: number, b: number): number => offPeriod(a - b, TAU);

describe('computeToolpaths', () => {
  it('cuts a circle with a round rosette, whatever the rubber', () => {
    const round = { radius: 30, wave: { kind: 'sine' as const, lobes: 12, amplitude: 0 } };
    for (const rubber of [{ shape: 'round', radius: 0 }, { shape: 'round', radius: 2 }, { shape: 'flat', width: 6 }] as const) {
      const path = computeToolpaths(settings({ rosette: round, rubber, pivotDistance: 150 })).passes[0];
      for (let i = 0; i < path.xyz.length / 3; i++) {
        expect(Math.hypot(path.xyz[i * 3], path.xyz[i * 3 + 1])).toBeCloseTo(20, 5);
      }
    }
  });

  it('matches the ideal formula with a knife edge and a very long arm', () => {
    expect(idealError(settings())).toBeLessThan(2e-4);
    const phased = settings({ job: job({ phaseStep: 10, from: 20, to: 21 }) });
    expect(computeToolpaths(phased).passes[1].pass.phase).toBe(10);
    expect(idealError(phased, 1)).toBeLessThan(2e-4);
  });

  it('carries the tip on the arc about the pivot on a short arm', () => {
    const P = 60;
    const s = settings({ pivotDistance: P });
    const { passes, rubberX } = computeToolpaths(s);
    const path = passes[0];
    const n = s.samplesPerTurn;
    const Rc = path.pass.radius;
    for (let i = 0; i <= n; i += 7) {
      const spindle = (i / n) * TAU;
      const phi = path.swing[i];
      const [hx, hy] = chuckToHeadstock([path.xyz[i * 3], path.xyz[i * 3 + 1]], spindle, 0);
      expect(hx).toBeCloseTo(Rc * Math.cos(phi) + P * Math.sin(phi), 5);
      expect(hy).toBeCloseTo(-Rc * Math.sin(phi) - P * (1 - Math.cos(phi)), 5);

      const gap = (sw: number): number => {
        const [x, y] = machineToHeadstock([rubberX, 0], P, sw);
        return Math.hypot(x, y) - radiusAt(s.rosette, Math.atan2(y, x) - spindle);
      };
      let lo = -0.1;
      for (let k = 1; k <= 2000; k++) {
        const sw = -0.1 + (0.2 * k) / 2000;
        if (gap(sw) <= 0) lo = sw;
      }
      let hi = lo + 0.2 / 2000;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (gap(mid) <= 0) lo = mid;
        else hi = mid;
      }
      expect(Math.abs(phi - lo)).toBeLessThan(1e-5);
    }
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

  it('pumps deeper on a pump lobe, read where the pump rubber faces the swung headstock', () => {
    const P = 60;
    const s = settings({
      pivotDistance: P,
      job: job({ from: 20, to: 21, pumpPhaseStep: 10 }),
      pump: {
        rosette: { radius: 30, wave: { kind: 'sine', lobes: 6, amplitude: 0.02 } },
        rubber: { shape: 'round', radius: 0 },
        gain: 2,
      },
    });
    const path = computeToolpaths(s).passes[1];
    const pumpPhase = (10 * Math.PI) / 180;
    const n = s.samplesPerTurn;
    let deepest = 0;
    let unswung = 0;
    for (let i = 0; i <= n; i++) {
      const spindle = (i / n) * TAU;
      const [hx, hy] = machineToHeadstock([30, 0], P, path.swing[i]);
      const facing = Math.atan2(hy, hx);
      const z = path.xyz[i * 3 + 2];
      expect(z).toBeCloseTo(-(0.05 + 2 * 0.02 * Math.cos(6 * (facing - spindle - pumpPhase))), 5);
      unswung = Math.max(unswung, Math.abs(z + 0.05 + 2 * 0.02 * Math.cos(6 * (-spindle - pumpPhase))));
      if (z < path.xyz[deepest * 3 + 2]) deepest = i;
    }
    expect(unswung).toBeGreaterThan(1e-3);
    expect(path.xyz[deepest * 3 + 2]).toBeCloseTo(-0.09, 4);
    const spindle = (deepest / n) * TAU;
    expect(offPeriod(spindle + pumpPhase, TAU / 6)).toBeLessThan((2 * Math.PI) / 180);
  });

  it('records the rubber touching where the rosette faces it', () => {
    const path = computeToolpaths(settings()).passes[0];
    const quarter = Math.floor(path.contact.length / 4);
    expect(angleBetween(path.contact[0], 0)).toBeLessThan(1e-3);
    expect(angleBetween(path.contact[quarter], (3 * Math.PI) / 2)).toBeLessThan(1e-2);
    for (const c of path.contact) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(TAU);
    }
  });

  it('keeps a contact just short of a full turn below 2π once stored', () => {
    const s = settings({
      rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } },
      job: job({ to: 21, phaseStep: 1e-6 }),
    });
    const c = computeToolpaths(s).passes[1].contact[0];
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(TAU);
  });

  it('records a big rubber touching a neighboring peak across a valley', () => {
    const s = settings({
      rosette: { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 1.5 } },
      rubber: { shape: 'round', radius: 3 },
      samplesPerTurn: 48,
    });
    const path = computeToolpaths(s).passes[0];
    expect(angleBetween(path.contact[1], TAU - TAU / 48)).toBeGreaterThan(TAU / 96);
  });

  it('flags where the wall is steeper than the arc, and jumps only there', () => {
    const s = settings({
      rosette: { radius: 30, wave: { kind: 'petal', lobes: 24, amplitude: 3, sharpness: 6 } },
      pivotDistance: 150,
      job: job({ from: 15, to: 15 }),
      samplesPerTurn: 2048,
    });
    const path = computeToolpaths(s).passes[0];
    expect(path.steep.some((f) => f === 1)).toBe(true);
    const r = (i: number): number => Math.hypot(path.xyz[i * 3], path.xyz[i * 3 + 1]);
    for (let i = 1; i < path.steep.length; i++) {
      if (Math.abs(r(i) - r(i - 1)) > 0.5) expect(path.steep[i] | path.steep[i - 1]).toBe(1);
    }
  });

  it('refuses a sample count that is not a whole number in range', () => {
    for (const samplesPerTurn of [0, 15, 100.5, 16385, Number.NaN])
      expect(() => computeToolpaths(settings({ samplesPerTurn }))).toThrow(/samplesPerTurn must be a whole number from 16 to 16384/);
  });

  it('refuses a job over the sample budget before computing any of it', () => {
    // 3001 radii × 24 divisions × 2049 samples is about 148 million
    const s = settings({ job: job({ from: 0, to: 60, step: 0.02, indexCount: 24 }), samplesPerTurn: 2048 });
    const started = performance.now();
    expect(() => computeToolpaths(s)).toThrow(/over the budget of 1,000,000/);
    expect(performance.now() - started).toBeLessThan(200);
  });

  it('counts wheel repeats against the sample budget', () => {
    const s = settings({
      job: job({ from: 1, to: 20, step: 1, wheelCount: 24 }),
      samplesPerTurn: 4096,
      chuck: { kind: 'eccentric', eccentricity: 0, wheel: 0 },
    });
    expect(() => computeToolpaths(s)).toThrow(/over the budget/);
  });
});
