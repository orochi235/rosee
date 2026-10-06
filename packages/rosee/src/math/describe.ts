import type { Toolpaths } from '../toolpath/toolpath';
import type { Settings } from '../toolpath/settings';
import {
  add,
  alias,
  apply,
  cos,
  div,
  evaluable,
  type Expr,
  fn,
  max,
  mul,
  name,
  neg,
  num,
  param,
  rel,
  rot,
  sub,
  sym,
  vec,
} from './expr';
import { reachValue, rosetteMath } from './rosette';
import type { Equation, Stage } from './stage';

export interface DescribeOptions {
  /** Points each "max over α" evaluates at. */
  samples?: number;
}

const theta = sym('θ');
const swing = sym('φ');
const beta = sym('β');
const H = name('H', 'φ', { sup: '−1' });

/** Formulas holding a print-only part, such as a drawn lobe, become
 *  definitions. */
const settle = (eqs: Equation[]): Equation[] =>
  eqs.map((eq) => (eq.kind === 'formula' && !evaluable(eq.rhs) ? { ...eq, kind: 'definition' } : eq));

/** Each stage of the simulation of pass `pass`, written out with the
 *  settings' numbers in it. */
export function describe(s: Settings, toolpaths: Toolpaths, pass: number, o: DescribeOptions = {}): Stage[] {
  const samples = o.samples ?? 1 << 12;
  const p = toolpaths.passes[pass].pass;
  const ch = s.chuck;
  const P = param(name('P'), s.pivotDistance);
  const X = param(name('X'), toolpaths.rubberX);
  const phase = param(name('phase'), p.phase, true);

  const headstockValue = (x: Expr, y: Expr): Expr => sub(rot(neg(swing), vec(x, add(y, P))), vec(num(0), P));
  const headstock = (x: Expr, y: Expr): Expr => alias(apply(H, x, y), headstockValue(x, y));

  const rosette = rosetteMath(s.rosette, name('r'), 'rosette');
  const R = name('R');
  const reach = reachValue(s.rubber, rosette, beta, samples);
  const psi = alias(apply(name('ψ'), swing), fn('arg', headstock(X, num(0))));
  const stages: Stage[] = [
    { title: 'Rosette', equations: rosette.equations },
    { title: 'Reach', equations: [{ id: 'reach', lhs: apply(R, beta), rhs: reach, kind: 'formula', unit: 'mm' }] },
    {
      title: 'Swing',
      equations: [
        {
          id: 'headstock',
          lhs: apply(H, sym('x'), sym('y')),
          rhs: headstockValue(sym('x'), sym('y')),
          args: ['x', 'y'],
          kind: 'formula',
          unit: 'mm',
        },
        { id: 'facing', lhs: psi, rhs: fn('arg', headstock(X, num(0))), kind: 'formula', unit: 'angle' },
        { id: 'direction', lhs: beta, rhs: sub(sub(psi, theta), phase), kind: 'formula', unit: 'angle' },
        {
          id: 'swing',
          lhs: swing,
          rhs: max(swing, swing, rel('=', fn('abs', headstock(X, num(0))), apply(R, sub(sub(psi, theta), phase)))),
          kind: 'definition',
          unit: 'angle',
          note: 'The spring holds the headstock at the largest swing that touches.',
        },
      ],
    },
  ];

  const index = param(name('index'), p.index, true);
  const tip = headstock(param(name('r', 'c'), p.radius), num(0));
  const onChuck = rot(sub(index, theta), tip);
  const chain: Equation[] = [];
  let work = onChuck;
  if (ch) {
    const e = param(name('e'), ch.eccentricity + p.eccentricity);
    const slideValue = ch.kind === 'eccentric' ? e : mul(e, cos(sub(sub(theta, index), param(name('ring'), ch.ring, true))));
    const slide = alias(sym('s'), slideValue);
    chain.push({ id: 'slide', lhs: slide, rhs: slideValue, kind: 'formula', unit: 'mm' });
    work = rot(neg(param(name('wheel'), ch.wheel + p.wheel, true)), sub(onChuck, vec(slide, num(0))));
  }
  chain.push({ id: 'chain', lhs: vec(sym('x'), sym('y')), rhs: work, kind: 'formula', unit: 'mm' });
  stages.push({ title: 'Chain', equations: chain });

  const depth = param(name('d', '0'), p.depth);
  const z = sym('z');
  if (s.pump && toolpaths.pumpX !== null) {
    const pumpRosette = rosetteMath(s.pump.rosette, name('r', 'pump'), 'pump.rosette');
    const Rpump = name('R', 'pump');
    const mean = param(name('X', 'pump'), toolpaths.pumpX);
    const pumpBeta = sym('β_pump', name('β', 'pump'));
    const pumpFacing = fn('arg', headstock(mean, num(0)));
    const reachHere = alias(apply(Rpump, pumpBeta), sym('R_pump', Rpump));
    stages.push(
      { title: 'Pumping rosette', equations: pumpRosette.equations },
      {
        title: 'Pump',
        equations: [
          {
            id: 'pump.reach',
            lhs: apply(Rpump, beta),
            rhs: reachValue(s.pump.rubber, pumpRosette, beta, samples),
            kind: 'formula',
            unit: 'mm',
          },
          {
            id: 'pump.direction',
            lhs: pumpBeta,
            rhs: sub(sub(pumpFacing, theta), param(name('phase', 'pump'), p.pumpPhase, true)),
            kind: 'formula',
            unit: 'angle',
          },
          {
            id: 'depth',
            lhs: z,
            rhs: neg(add(depth, mul(param(name('g'), s.pump.gain), sub(reachHere, mean)))),
            kind: 'formula',
            unit: 'mm',
          },
        ],
      },
    );
  } else stages.push({ title: 'Depth', equations: [{ id: 'depth', lhs: z, rhs: neg(depth), kind: 'formula', unit: 'mm' }] });

  const V = param(name('V'), s.cutter.vAngle, true);
  stages.push({
    title: 'Groove',
    equations: [
      {
        id: 'groove',
        lhs: sym('w_groove', name('w', 'groove')),
        rhs: add(param(name('f'), s.cutter.tipFlat), mul(num(2), sym('depth', name('d')), fn('tan', div(V, num(2))))),
        kind: 'formula',
        unit: 'mm',
        note: 'd is the depth of cut, −z.',
      },
    ],
  });
  return stages.map((st) => ({ ...st, equations: settle(st.equations) }));
}
