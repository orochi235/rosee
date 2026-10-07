import { describe as group, expect, it } from 'vitest';
import { TAU } from '../angle';
import { contactTable, reachAt, type Rubber } from '../contact/table';
import { grooveWidth } from '../cutter/cutter';
import { machineToHeadstock } from '../machine/pose';
import { PRESETS } from '../presets';
import { radiusAt, type Wave } from '../rosette/rosette';
import type { Settings } from '../toolpath/settings';
import { computeToolpaths, type Toolpaths } from '../toolpath/toolpath';
import { describe } from './describe';
import { sampleEnv } from './env';
import { evaluate } from './evaluate';
import { equation, equationMathML, type Stage } from './stage';

const num = (v: unknown): number => {
  if (typeof v !== 'number') throw new Error('expected a number');
  return v;
};

const WAVES: Record<string, Wave> = {
  sine: { kind: 'sine', lobes: 12, amplitude: 1 },
  flat: { kind: 'flat', lobes: 9, amplitude: 1.2, flat: 0.4 },
  petal: { kind: 'petal', lobes: 8, amplitude: 1, sharpness: 2.5 },
  scallop: { kind: 'scallop', lobes: 10, amplitude: 0.8 },
  compound: {
    kind: 'compound',
    waves: [
      { kind: 'sine', lobes: 6, amplitude: 1 },
      { kind: 'petal', lobes: 18, amplitude: 0.3, sharpness: 1.5 },
    ],
  },
};

const RUBBERS: Record<string, Rubber> = {
  knife: { shape: 'round', radius: 0 },
  round: { shape: 'round', radius: 1.5 },
  flat: { shape: 'flat', width: 3 },
};

const small = (s: Settings): Settings => ({ ...s, samplesPerTurn: 256, job: { ...s.job, to: s.job.from + 2 * s.job.step } });

const CASES: [string, Settings][] = [
  ...Object.entries(PRESETS).map(([k, s]): [string, Settings] => [`preset ${k}`, small(s)]),
  ...Object.entries(WAVES).flatMap(([wk, wave]) =>
    Object.entries(RUBBERS).map(([rk, rubber]): [string, Settings] => [
      `${wk} rosette, ${rk} rubber`,
      small({ ...PRESETS.swirl, rosette: { radius: 30, wave }, rubber }),
    ]),
  ),
  [
    'pumped on an elliptical chuck',
    small({
      ...PRESETS.oval,
      pump: { rosette: { radius: 25, wave: WAVES.flat }, rubber: RUBBERS.round, gain: 0.05 },
      job: { ...PRESETS.oval.job, pumpPhaseStep: 7, eccentricityStep: 0.2 },
    }),
  ],
];

const solved = new Map<string, { s: Settings; t: Toolpaths }>();
const of = (name: string, s: Settings) => {
  let r = solved.get(name);
  if (!r) solved.set(name, (r = { s, t: computeToolpaths(s) }));
  return r;
};

group.each(CASES)('%s', (name, settings) => {
  const { s, t } = of(name, settings);
  const passes = [0, t.passes.length - 1];
  const stages = (k: number, samples?: number): Stage[] => describe(s, t, k, { samples });

  it('evaluates the rosette radius as radiusAt does', () => {
    const r = equation(stages(0), 'rosette').rhs;
    for (let k = 0; k < 360; k++) {
      const a = (k / 360) * TAU - 1;
      expect(num(evaluate(r, { α: a }))).toBeCloseTo(radiusAt(s.rosette, a), 9);
    }
  });

  it('evaluates the reach as the contact table holds it', () => {
    const table = contactTable(s.rosette, s.rubber);
    const reach = equation(stages(0), 'reach').rhs;
    for (let k = 0; k < table.reach.length; k += 16) {
      const b = (k / table.reach.length) * TAU;
      expect(Math.abs(num(evaluate(reach, { β: b })) - table.reach[k])).toBeLessThan(2e-5);
    }
  });

  it('runs the headstock transform as machineToHeadstock does', () => {
    const h = equation(stages(0), 'headstock').rhs;
    for (const [x, y, φ] of [[30, 0, 0.01], [12, -3, -0.02], [0, 5, 0.1]]) {
      const [hx, hy] = machineToHeadstock([x, y], s.pivotDistance, φ);
      const v = evaluate(h, { x, y, φ }) as number[];
      expect(v[0]).toBeCloseTo(hx, 9);
      expect(v[1]).toBeCloseTo(hy, 9);
    }
  });

  it('carries the tip through the chain to every sample of the path', () => {
    for (const k of passes) {
      const st = stages(k);
      const path = t.passes[k];
      const chain = equation(st, 'chain').rhs;
      const slide = (s.chuck || s.engine.kind === 'straight') && equation(st, 'slide').rhs;
      for (let i = 0; i <= t.samples; i += 4) {
        const env = sampleEnv(st, s, t, k, i);
        const [x, y] = evaluate(chain, env) as number[];
        expect(Math.abs(x - path.xyz[i * 3])).toBeLessThan(1e-4);
        expect(Math.abs(y - path.xyz[i * 3 + 1])).toBeLessThan(1e-4);
        if (slide) expect(num(evaluate(slide, env))).toBeCloseTo(path.slide[i], 5);
      }
    }
  });

  it('gives the depth the path cuts', () => {
    const pump = s.pump && contactTable(s.pump.rosette, s.pump.rubber);
    for (const k of passes) {
      const st = stages(k);
      const path = t.passes[k];
      for (let i = 0; i <= t.samples; i += 4) {
        const env = { ...sampleEnv(st, s, t, k, i) };
        // Replace the reach read back from the path with the table's, so the formula is checked, not echoed.
        if (pump) env.R_pump = reachAt(pump, num(evaluate(equation(st, 'pump.direction').rhs, env)));
        expect(Math.abs(num(evaluate(equation(st, 'depth').rhs, env)) - path.xyz[i * 3 + 2])).toBeLessThan(1e-5);
      }
    }
  });

  it('puts the tip on the sheet where the path does', () => {
    if (s.surface.kind === 'flat') return;
    for (const k of passes) {
      const st = stages(k);
      const path = t.passes[k];
      for (let i = 0; i <= t.samples; i += 4) {
        const [u, v, h] = evaluate(equation(st, 'sheet').rhs, sampleEnv(st, s, t, k, i)) as number[];
        expect(Math.abs(u - path.uvh[i * 3])).toBeLessThan(1e-4);
        expect(Math.abs(v - path.uvh[i * 3 + 1])).toBeLessThan(1e-4);
        expect(Math.abs(h - path.uvh[i * 3 + 2])).toBeLessThan(1e-4);
      }
    }
  });

  it('gives the groove width grooveWidth does', () => {
    const w = equation(stages(0), 'groove').rhs;
    for (const depth of [0, 0.05, 0.3]) expect(num(evaluate(w, { depth }))).toBeCloseTo(grooveWidth(s.cutter, depth), 12);
  });

  it('binds every symbol a formula prints', () => {
    for (const k of passes) {
      const st = stages(k);
      const env = sampleEnv(st, s, t, k, 17);
      for (const eq of st.flatMap((x) => x.equations))
        if (eq.kind === 'formula')
          expect(() => evaluate(eq.rhs, { ...env, ...Object.fromEntries((eq.args ?? []).map((a) => [a, 1])) }), eq.id).not.toThrow();
    }
  });
});

group('describe', () => {
  it('turns a drawn rosette and its reach into definitions', () => {
    const s = small({
      ...PRESETS.swirl,
      rosette: { radius: 30, wave: { kind: 'drawn', lobes: 6, amplitude: 1, points: [{ u: 0, p: 1 }, { u: 0.5, p: -1 }] } },
    });
    const st = describe(s, computeToolpaths(s), 0);
    expect(equation(st, 'rosette').kind).toBe('definition');
    expect(equation(st, 'reach').kind).toBe('definition');
    expect(equation(st, 'rosette.p').kind).toBe('definition');
    expect(equation(st, 'chain').kind).toBe('formula');
  });

  it.each(Object.keys(PRESETS))('prints %s the same as last time', (k) => {
    const s = small(PRESETS[k as keyof typeof PRESETS]);
    const st = describe(s, computeToolpaths(s), 0);
    const printed = st.map((x) => ({
      title: x.title,
      equations: x.equations.map((eq) => [equationMathML(eq), equationMathML(eq, { numbers: true })]),
    }));
    expect(printed).toMatchSnapshot();
  });
});
