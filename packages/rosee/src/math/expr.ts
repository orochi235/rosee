/** How a symbol prints: a base with an optional subscript, superscript and
 *  bar, e.g. `{ base: 'R', sub: 'pump', bar: true }` for R̄ with "pump" below. */
export interface Name {
  base: string;
  sub?: string;
  sup?: string;
  bar?: boolean;
}

export type Fn = 'cos' | 'sin' | 'tan' | 'sqrt' | 'abs' | 'arg' | 'min';
export type Rel = '≤' | '≥' | '=';

/** An expression that both prints as MathML and evaluates. Angles evaluate
 *  in radians; a `deg` setting prints in degrees and evaluates in radians. */
export type Expr =
  | { op: 'num'; value: number }
  /** A setting: prints its name, or its number when printing numbers.
   *  `fixed` always prints the name (π). */
  | { op: 'param'; name: Name; value: number; deg?: boolean; fixed?: boolean }
  /** A variable the environment binds, by `id`. */
  | { op: 'sym'; id: string; name: Name }
  /** Prints `shown`, evaluates `value`: an abbreviation defined by an
   *  equation of its own. */
  | { op: 'alias'; shown: Expr; value: Expr }
  /** Prints only: a function applied to arguments, e.g. r(α). */
  | { op: 'apply'; fn: Name; args: Expr[] }
  | { op: 'add'; terms: Expr[] }
  | { op: 'neg'; arg: Expr }
  | { op: 'mul'; factors: Expr[] }
  | { op: 'div'; num: Expr; den: Expr }
  | { op: 'pow'; base: Expr; exp: Expr }
  | { op: 'fn'; fn: Fn; args: Expr[] }
  | { op: 'mod'; arg: Expr; by: Expr }
  | { op: 'vec'; items: Expr[] }
  /** The rotation of a vector by an angle. */
  | { op: 'rot'; angle: Expr; arg: Expr }
  | { op: 'rel'; rel: Rel; a: Expr; b: Expr }
  /** The first case whose `when` holds, else `otherwise`. */
  | { op: 'cases'; cases: { when: Expr; then: Expr }[]; otherwise: Expr }
  /** The largest `body` over a turn of the variable `over`, among the
   *  values where `when` holds. Evaluates at `samples` points. */
  | { op: 'max'; over: Extract<Expr, { op: 'sym' }>; when?: Expr; body: Expr; samples: number }
  /** Prints only: a grid of cells. */
  | { op: 'table'; rows: Expr[][] }
  /** Prints only: words. */
  | { op: 'text'; text: string };

export const name = (base: string, sub?: string, extra: Omit<Name, 'base' | 'sub'> = {}): Name => ({ base, sub, ...extra });

export const num = (value: number): Expr => ({ op: 'num', value });
export const param = (n: Name, value: number, deg = false): Expr => ({ op: 'param', name: n, value, deg });
export const PI: Expr = { op: 'param', name: name('π'), value: Math.PI, fixed: true };
export const sym = (id: string, n: Name = name(id)): Extract<Expr, { op: 'sym' }> => ({ op: 'sym', id, name: n });
export const alias = (shown: Expr, value: Expr): Expr => ({ op: 'alias', shown, value });
export const apply = (fn: Name, ...args: Expr[]): Expr => ({ op: 'apply', fn, args });
export const add = (...terms: Expr[]): Expr => ({ op: 'add', terms: terms.flatMap((t) => (t.op === 'add' ? t.terms : [t])) });
export const neg = (arg: Expr): Expr => ({ op: 'neg', arg });
export const sub = (a: Expr, b: Expr): Expr => add(a, neg(b));
export const mul = (...factors: Expr[]): Expr => ({ op: 'mul', factors });
export const div = (n: Expr, d: Expr): Expr => ({ op: 'div', num: n, den: d });
export const pow = (base: Expr, exp: Expr): Expr => ({ op: 'pow', base, exp });
export const fn = (f: Fn, ...args: Expr[]): Expr => ({ op: 'fn', fn: f, args });
export const cos = (a: Expr): Expr => fn('cos', a);
export const sin = (a: Expr): Expr => fn('sin', a);
export const mod = (arg: Expr, by: Expr): Expr => ({ op: 'mod', arg, by });
export const vec = (...items: Expr[]): Expr => ({ op: 'vec', items });
export const rot = (angle: Expr, arg: Expr): Expr => ({ op: 'rot', angle, arg });
export const rel = (r: Rel, a: Expr, b: Expr): Expr => ({ op: 'rel', rel: r, a, b });
export const cases = (list: { when: Expr; then: Expr }[], otherwise: Expr): Expr => ({ op: 'cases', cases: list, otherwise });
export const max = (over: Extract<Expr, { op: 'sym' }>, body: Expr, when?: Expr, samples = 1 << 12): Expr => ({
  op: 'max',
  over,
  when,
  body,
  samples,
});
export const table = (rows: Expr[][]): Expr => ({ op: 'table', rows });
export const text = (t: string): Expr => ({ op: 'text', text: t });

/** Whether the expression evaluates: false where it holds a print-only node
 *  outside an alias's shown side. */
export function evaluable(e: Expr): boolean {
  switch (e.op) {
    case 'apply':
    case 'table':
    case 'text':
      return false;
    case 'num':
    case 'param':
    case 'sym':
      return true;
    case 'alias':
      return evaluable(e.value);
    case 'add':
      return e.terms.every(evaluable);
    case 'mul':
      return e.factors.every(evaluable);
    case 'neg':
      return evaluable(e.arg);
    case 'div':
      return evaluable(e.num) && evaluable(e.den);
    case 'pow':
      return evaluable(e.base) && evaluable(e.exp);
    case 'fn':
      return e.args.every(evaluable);
    case 'mod':
      return evaluable(e.arg) && evaluable(e.by);
    case 'vec':
      return e.items.every(evaluable);
    case 'rot':
      return evaluable(e.angle) && evaluable(e.arg);
    case 'rel':
      return evaluable(e.a) && evaluable(e.b);
    case 'cases':
      return e.cases.every((c) => evaluable(c.when) && evaluable(c.then)) && evaluable(e.otherwise);
    case 'max':
      return evaluable(e.body) && (!e.when || evaluable(e.when));
  }
}
