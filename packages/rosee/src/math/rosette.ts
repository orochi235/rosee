import type { Rubber } from '../contact/table';
import type { Rosette, Wave } from '../rosette/rosette';
import {
  add,
  alias,
  apply,
  cases,
  cos,
  div,
  type Expr,
  fn,
  max,
  mod,
  mul,
  type Name,
  name,
  num,
  param,
  PI,
  pow,
  rel,
  sin,
  sub,
  sym,
  table,
  text,
} from './expr';
import type { Equation } from './stage';

type SimpleWave = Exclude<Wave, { kind: 'compound' }>;

const flatten = (w: Wave): SimpleWave[] => (w.kind === 'compound' ? w.waves.flatMap(flatten) : [w]);

/** One wave's lobe, written in terms of the lobe position `u`. */
function lobe(w: SimpleWave, u: Expr, k: string | undefined): { value: Expr; d?: Expr } {
  const d = alias(sym('d', name('d', k)), fn('min', u, sub(num(1), u)));
  switch (w.kind) {
    case 'sine':
      return { value: cos(mul(num(2), PI, u)) };
    case 'flat': {
      const F = param(name('F', k), w.flat);
      const quarter = div(F, num(4));
      return {
        value: cases(
          [
            { when: rel('≤', d, quarter), then: num(1) },
            { when: rel('≥', d, sub(div(num(1), num(2)), quarter)), then: num(-1) },
          ],
          cos(div(mul(PI, sub(d, quarter)), sub(div(num(1), num(2)), div(F, num(2))))),
        ),
        d,
      };
    }
    case 'petal':
      return { value: sub(mul(num(2), pow(sub(num(1), mul(num(2), d)), param(name('σ', k), w.sharpness))), num(1)), d };
    case 'scallop':
      return { value: sub(mul(num(2), fn('sqrt', sub(num(1), pow(mul(num(2), d), num(2))))), num(1)), d };
    case 'drawn':
      return { value: apply(name('p', k), u) };
  }
}

/** A rosette written out: `at(angle)` is its radius at a rosette-local
 *  angle, printed as `fn(angle)`; `equations` define it. */
export interface RosetteMath {
  at(angle: Expr): Expr;
  equations: Equation[];
}

export function rosetteMath(r: Rosette, fnName: Name, id: string): RosetteMath {
  const waves = flatten(r.wave);
  const r0 = param(name('r', '0'), r.radius);
  const parts = (angle: Expr) =>
    waves.map((w, i) => {
      const k = waves.length > 1 ? String(i + 1) : undefined;
      const n = param(name('n', k), w.lobes);
      const A = param(name('A', k), w.amplitude);
      const uValue = mod(div(mul(n, angle), mul(num(2), PI)), num(1));
      const u = alias(sym('u', name('u', k)), uValue);
      const { value, d } = lobe(w, u, k);
      return { w, k, A, uValue, u, value, d, p: alias(apply(name('p', k), u), value) };
    });
  const value = (angle: Expr) => add(r0, ...parts(angle).map(({ A, p }) => mul(A, p)));
  const alpha = sym('α');
  const equations: Equation[] = [{ id, lhs: apply(fnName, alpha), rhs: value(alpha), kind: 'formula', unit: 'mm' }];
  for (const { w, k, uValue, u, value: p, d } of parts(alpha)) {
    const at = (s: string) => `${id}.${s}${k ?? ''}`;
    equations.push({ id: at('u'), lhs: u, rhs: uValue, kind: 'formula', unit: 'ratio' });
    if (w.kind === 'drawn') {
      const pts = [...w.points].sort((a, b) => a.u - b.u);
      equations.push({
        id: at('p'),
        lhs: apply(name('p', k), u),
        rhs: table([[text('u'), ...pts.map((q) => num(q.u))], [text('p'), ...pts.map((q) => num(q.p))]]),
        kind: 'definition',
        unit: 'ratio',
        note: 'The periodic monotone cubic through these points.',
      });
      continue;
    }
    equations.push({ id: at('p'), lhs: apply(name('p', k), u), rhs: p, kind: 'formula', unit: 'ratio' });
    if (d && d.op === 'alias') equations.push({ id: at('d'), lhs: d, rhs: d.value, kind: 'formula', unit: 'ratio' });
  }
  return { at: (angle) => alias(apply(fnName, angle), value(angle)), equations };
}

/** How far out the rubber stops in direction `dir` round the rosette: the
 *  farthest the rubber can sit while touching some point of the outline. */
export function reachValue(rubber: Rubber, rosette: RosetteMath, dir: Expr, samples: number): Expr {
  if (rubber.shape === 'round' && rubber.radius === 0) return rosette.at(dir);
  const alpha = sym('α');
  const r = rosette.at(alpha);
  const across = mul(r, sin(sub(alpha, dir)));
  const along = mul(r, cos(sub(alpha, dir)));
  if (rubber.shape === 'flat') {
    const half = div(param(name('w'), rubber.width), num(2));
    return max(alpha, along, rel('≤', fn('abs', across), half), samples);
  }
  const rho = param(name('ρ'), rubber.radius);
  return max(alpha, add(along, fn('sqrt', sub(pow(rho, num(2)), pow(across, num(2))))), rel('≤', fn('abs', across), rho), samples);
}
