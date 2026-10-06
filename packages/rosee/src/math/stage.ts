import type { Expr } from './expr';
import { type MathMLOptions, toMathML } from './mathml';

/** What an equation's value measures, for display. */
export type Unit = 'mm' | 'angle' | 'ratio';

/** `lhs = rhs`. A formula's right side evaluates; a definition's is implicit
 *  or tabulated and only prints. */
export interface Equation {
  /** Stable within one description, for tests and lookups. */
  id: string;
  lhs: Expr;
  rhs: Expr;
  kind: 'formula' | 'definition';
  unit: Unit;
  /** Symbol ids the left side takes as arguments, as in H(x, y): the
   *  formula holds for any values of them, so no playhead value is shown. */
  args?: string[];
  /** Words printed beneath the equation. */
  note?: string;
}

export interface Stage {
  title: string;
  equations: Equation[];
}

/** The equation as a `<math>` element. */
export const equationMathML = (eq: Equation, o: MathMLOptions = {}): string =>
  `<math display="block">${toMathML(eq.lhs, o)}<mo>=</mo>${toMathML(eq.rhs, o)}</math>`;

/** The equation with that id, or an error naming it. */
export function equation(stages: readonly Stage[], id: string): Equation {
  for (const s of stages) for (const eq of s.equations) if (eq.id === id) return eq;
  throw new Error(`no equation ${id}`);
}
