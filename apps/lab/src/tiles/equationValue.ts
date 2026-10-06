import { deg, type Env, type Equation, evaluate, type Unit, type Value } from 'rosee';

/** An angle in degrees, wrapped to (−180, 180]. */
const degrees = (a: number): string => {
  const d = deg(a) % 360;
  const w = d > 180 ? d - 360 : d <= -180 ? d + 360 : d;
  return `${w.toFixed(3)}°`;
};

const minus = (s: string): string => s.replace(/-/g, '−');

function format(v: Value, unit: Unit): string {
  return minus(raw(v, unit));
}

function raw(v: Value, unit: Unit): string {
  if (typeof v !== 'number') return `(${v.map((x) => x.toFixed(3)).join(', ')})${unit === 'mm' ? ' mm' : ''}`;
  if (unit === 'angle') return degrees(v);
  if (unit === 'mm') return `${v.toFixed(4)} mm`;
  return v.toFixed(4);
}

/** The equation's value at the playhead, or '' where it has none: a
 *  function of arguments, or a definition whose left side the playhead
 *  does not bind. */
export function equationValue(eq: Equation, env: Env): string {
  if (eq.args) return '';
  try {
    if (eq.kind === 'formula') return format(evaluate(eq.rhs, env), eq.unit);
    return eq.lhs.op === 'sym' && eq.lhs.id in env ? format(env[eq.lhs.id], eq.unit) : '';
  } catch {
    return '';
  }
}
