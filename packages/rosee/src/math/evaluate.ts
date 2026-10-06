import { rad, TAU } from '../angle';
import type { Expr } from './expr';

/** A number, or a 2D vector. */
export type Value = number | readonly number[];

/** Values for the variables an expression reads, by symbol id. */
export type Env = Readonly<Record<string, Value>>;

type Compiled = (env: Env) => Value;

const compiled = new WeakMap<Expr, Compiled>();

const scalar = (v: Value, what: string): number => {
  if (typeof v !== 'number') throw new Error(`${what} needs a number, got a vector`);
  return v;
};

const vector = (v: Value, what: string): readonly number[] => {
  if (typeof v === 'number') throw new Error(`${what} needs a vector, got a number`);
  return v;
};

function sum(a: Value, b: Value): Value {
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  const va = vector(a, 'adding a vector');
  const vb = vector(b, 'adding a vector');
  return va.map((x, i) => x + vb[i]);
}

function product(a: Value, b: Value): Value {
  if (typeof a === 'number') return typeof b === 'number' ? a * b : b.map((x) => a * x);
  return product(b, scalar(a, 'multiplying a vector'));
}

const FNS = {
  cos: (v: Value) => Math.cos(scalar(v, 'cos')),
  sin: (v: Value) => Math.sin(scalar(v, 'sin')),
  tan: (v: Value) => Math.tan(scalar(v, 'tan')),
  sqrt: (v: Value) => Math.sqrt(scalar(v, 'sqrt')),
  abs: (v: Value) => (typeof v === 'number' ? Math.abs(v) : Math.hypot(...v)),
  arg: (v: Value) => {
    const [x, y] = vector(v, 'arg');
    return Math.atan2(y, x);
  },
};

function compile(e: Expr): Compiled {
  let c = compiled.get(e);
  if (c) return c;
  c = build(e);
  compiled.set(e, c);
  return c;
}

function build(e: Expr): Compiled {
  switch (e.op) {
    case 'num':
    case 'param': {
      const v = e.op === 'param' && e.deg ? rad(e.value) : e.value;
      return () => v;
    }
    case 'sym': {
      const id = e.id;
      return (env) => {
        const v = env[id];
        if (v === undefined) throw new Error(`nothing binds ${id}`);
        return v;
      };
    }
    case 'alias':
      return compile(e.value);
    case 'add': {
      const terms = e.terms.map(compile);
      return (env) => terms.slice(1).reduce((acc, t) => sum(acc, t(env)), terms[0](env));
    }
    case 'neg': {
      const a = compile(e.arg);
      return (env) => product(-1, a(env));
    }
    case 'mul': {
      const fs = e.factors.map(compile);
      return (env) => fs.slice(1).reduce((acc, f) => product(acc, f(env)), fs[0](env));
    }
    case 'div': {
      const n = compile(e.num);
      const d = compile(e.den);
      return (env) => product(n(env), 1 / scalar(d(env), 'a divisor'));
    }
    case 'pow': {
      const b = compile(e.base);
      const x = compile(e.exp);
      return (env) => Math.pow(scalar(b(env), 'a power'), scalar(x(env), 'an exponent'));
    }
    case 'fn': {
      const args = e.args.map(compile);
      if (e.fn === 'min') return (env) => Math.min(...args.map((a) => scalar(a(env), 'min')));
      const f = FNS[e.fn];
      return (env) => f(args[0](env));
    }
    case 'mod': {
      const a = compile(e.arg);
      const by = compile(e.by);
      return (env) => {
        const x = scalar(a(env), 'mod');
        const m = scalar(by(env), 'mod');
        return x - m * Math.floor(x / m);
      };
    }
    case 'vec': {
      const items = e.items.map(compile);
      return (env) => items.map((i) => scalar(i(env), 'a vector component'));
    }
    case 'rot': {
      const angle = compile(e.angle);
      const arg = compile(e.arg);
      return (env) => {
        const a = scalar(angle(env), 'a rotation');
        const [x, y] = vector(arg(env), 'a rotation');
        const c = Math.cos(a);
        const s = Math.sin(a);
        return [c * x - s * y, s * x + c * y];
      };
    }
    case 'rel': {
      const a = compile(e.a);
      const b = compile(e.b);
      const test =
        e.rel === '≤' ? (x: number, y: number) => x <= y : e.rel === '≥' ? (x: number, y: number) => x >= y : (x: number, y: number) => x === y;
      return (env) => (test(scalar(a(env), e.rel), scalar(b(env), e.rel)) ? 1 : 0);
    }
    case 'cases': {
      const list = e.cases.map((k) => ({ when: compile(k.when), then: compile(k.then) }));
      const otherwise = compile(e.otherwise);
      return (env) => {
        for (const k of list) if (k.when(env)) return k.then(env);
        return otherwise(env);
      };
    }
    case 'max': {
      const body = compile(e.body);
      const when = e.when && compile(e.when);
      const { id } = e.over;
      const n = e.samples;
      const step = TAU / n;
      return (env) => {
        const scope: Record<string, Value> = Object.create(env);
        const holds = (a: number): boolean => {
          scope[id] = a;
          return !when || !!when(scope);
        };
        const at = (a: number): number => {
          scope[id] = a;
          return scalar(body(scope), 'max');
        };
        let best = -Infinity;
        let bestAt = 0;
        const consider = (a: number): void => {
          const v = at(a);
          if (v > best) {
            best = v;
            bestAt = a;
          }
        };
        let was = holds(-step);
        for (let k = 0; k < n; k++) {
          const a = k * step;
          const is = holds(a);
          // Where the condition flips, the max may sit on its edge: find the edge.
          if (is !== was) {
            let lo = was ? a - step : a;
            let hi = was ? a : a - step;
            for (let i = 0; i < 40; i++) {
              const mid = (lo + hi) / 2;
              if (holds(mid)) lo = mid;
              else hi = mid;
            }
            consider(lo);
          }
          if (is) consider(a);
          was = is;
        }
        if (best === -Infinity) throw new Error(`no ${id} satisfies the max's condition`);
        // Close in on a peak between samples.
        let lo = bestAt - step;
        let hi = bestAt + step;
        for (let i = 0; i < 60; i++) {
          const m1 = lo + (hi - lo) / 3;
          const m2 = hi - (hi - lo) / 3;
          const v1 = holds(m1) ? at(m1) : -Infinity;
          const v2 = holds(m2) ? at(m2) : -Infinity;
          if (v1 < v2) lo = m1;
          else hi = m2;
        }
        if (holds(lo)) consider(lo);
        return best;
      };
    }
    case 'apply':
    case 'table':
    case 'text':
      return () => {
        throw new Error(`${e.op} only prints`);
      };
  }
}

/** The expression's value with `env` binding its variables. Throws on a
 *  variable `env` leaves unbound. */
export const evaluate = (e: Expr, env: Env): Value => compile(e)(env);
