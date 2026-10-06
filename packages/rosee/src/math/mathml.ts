import type { Expr, Name } from './expr';

/** How tightly a printed expression binds, so its parent knows when to
 *  bracket it. */
const REL = 0;
const ADD = 1;
const MOD = 2;
const NEG = 3;
const MUL = 4;
const ATOM = 9;

interface Printed {
  ml: string;
  prec: number;
  /** Starts with a digit, so juxtaposing it after a factor needs a dot. */
  numeric: boolean;
  /** Starts with a named function, which juxtaposition would run into. */
  word?: boolean;
}

export interface MathMLOptions {
  /** Print settings as their numbers instead of their names. */
  numbers?: boolean;
}

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const mo = (s: string): string => `<mo>${escape(s)}</mo>`;
const row = (...parts: string[]): string => `<mrow>${parts.join('')}</mrow>`;
const paren = (ml: string): string => row(mo('('), ml, mo(')'));

/** A number to four decimals at most, trailing zeros dropped. */
const digits = (v: number): string => String(Number(Math.abs(v).toFixed(4)));

function word(s: string): string {
  if (/^\d+$/.test(s)) return `<mn>${s}</mn>`;
  return [...s].length === 1 ? `<mi>${escape(s)}</mi>` : `<mi mathvariant="normal">${escape(s)}</mi>`;
}

export function nameML(n: Name): string {
  const base = word(n.base);
  const sub = n.sub && word(n.sub);
  const sup = n.sup && `<mn>${escape(n.sup)}</mn>`;
  if (sub && sup) return `<msubsup>${base}${sub}${sup}</msubsup>`;
  if (sub) return `<msub>${base}${sub}</msub>`;
  if (sup) return `<msup>${base}${sup}</msup>`;
  return base;
}

function number(v: number, deg: boolean): Printed {
  const ml = `<mn>${digits(v)}</mn>${deg ? mo('°') : ''}`;
  return v < 0 ? { ml: row(mo('−'), ml), prec: NEG, numeric: false } : { ml: deg ? row(ml) : ml, prec: ATOM, numeric: true };
}

const atom = (ml: string): Printed => ({ ml, prec: ATOM, numeric: false });

function print(e: Expr, o: MathMLOptions): Printed {
  const at = (x: Expr, min: number): string => {
    const p = print(x, o);
    return p.prec < min ? paren(p.ml) : p.ml;
  };
  const list = (xs: Expr[]): string => xs.map((x) => at(x, REL + 1)).join(mo(','));
  switch (e.op) {
    case 'num':
      return number(e.value, false);
    case 'param':
      return o.numbers && !e.fixed ? number(e.value, !!e.deg) : atom(nameML(e.name));
    case 'sym':
      return atom(nameML(e.name));
    case 'alias':
      return print(e.shown, o);
    case 'apply':
      return atom(row(nameML(e.fn), mo('⁡'), paren(list(e.args))));
    case 'add': {
      const parts = e.terms.map((t, i) => {
        const p = print(t, o);
        // A minus inside the sum's own row is infix and spaced; wrapped in a row of its own it is a tight prefix.
        const minus = i === 0 ? (ml: string) => row(mo('−'), ml) : (ml: string) => mo('−') + ml;
        if (t.op === 'neg') return minus(at(t.arg, MUL));
        if ((t.op === 'num' || t.op === 'param') && p.prec === NEG) return minus(number(-t.value, t.op === 'param' && !!t.deg).ml);
        return (i === 0 ? '' : mo('+')) + (p.prec <= ADD ? paren(p.ml) : p.ml);
      });
      const first = print(e.terms[0], o);
      return { ml: row(...parts), prec: ADD, numeric: first.numeric };
    }
    case 'neg':
      return { ml: row(mo('−'), at(e.arg, MUL)), prec: NEG, numeric: false };
    case 'mul': {
      const parts: string[] = [];
      e.factors.forEach((f, i) => {
        const p = print(f, o);
        if (i > 0) parts.push(mo(p.numeric ? '·' : '⁢') + (p.word ? '<mspace width="0.1667em"/>' : ''));
        parts.push(p.prec < MUL ? paren(p.ml) : p.ml);
      });
      return { ml: row(...parts), prec: MUL, numeric: print(e.factors[0], o).numeric };
    }
    case 'div':
      return atom(`<mfrac>${row(print(e.num, o).ml)}${row(print(e.den, o).ml)}</mfrac>`);
    case 'pow': {
      const base = print(e.base, o);
      return {
        ml: `<msup>${base.prec < ATOM ? paren(base.ml) : row(base.ml)}${row(print(e.exp, o).ml)}</msup>`,
        prec: ATOM,
        numeric: base.numeric,
      };
    }
    case 'fn':
      switch (e.fn) {
        case 'sqrt':
          return atom(`<msqrt>${print(e.args[0], o).ml}</msqrt>`);
        case 'abs':
          return atom(row(mo('|'), print(e.args[0], o).ml, mo('|')));
        case 'arg': {
          const p = print(e.args[0], o);
          return { ml: row(word('arg'), mo('⁡'), p.prec < ATOM ? paren(p.ml) : `<mspace width="0.1667em"/>${p.ml}`), prec: MUL, numeric: false, word: true };
        }
        default:
          return { ...atom(row(word(e.fn), mo('⁡'), paren(list(e.args)))), word: true };
      }
    case 'mod':
      return { ml: row(at(e.arg, MUL), mo('mod'), at(e.by, MUL)), prec: MOD, numeric: print(e.arg, o).numeric };
    case 'vec':
      return atom(paren(list(e.items)));
    case 'rot':
      return { ml: row(word('Rot'), paren(print(e.angle, o).ml), at(e.arg, ATOM)), prec: MUL, numeric: false, word: true };
    case 'rel':
      return { ml: row(at(e.a, ADD), mo(e.rel), at(e.b, ADD)), prec: REL, numeric: false };
    case 'cases': {
      const line = (value: Expr, cond: string): string =>
        `<mtr><mtd>${print(value, o).ml}</mtd><mtd>${cond}</mtd></mtr>`;
      const rows = [
        ...e.cases.map((k) => line(k.then, row(`<mtext>if&#xA0;</mtext>`, print(k.when, o).ml))),
        line(e.otherwise, '<mtext>otherwise</mtext>'),
      ];
      return atom(row(mo('{'), `<mtable columnalign="left">${rows.join('')}</mtable>`));
    }
    case 'max': {
      const under = e.when ? row(nameML(e.over.name), mo(':'), print(e.when, o).ml) : nameML(e.over.name);
      const body = print(e.body, o);
      return {
        ml: row(`<munder>${word('max')}${under}</munder>`, body.prec <= REL ? paren(body.ml) : body.ml),
        prec: ADD,
        numeric: false,
      };
    }
    case 'table':
      return atom(
        `<mtable>${e.rows.map((r) => `<mtr>${r.map((c) => `<mtd>${print(c, o).ml}</mtd>`).join('')}</mtr>`).join('')}</mtable>`,
      );
    case 'text':
      return atom(`<mtext>${escape(e.text)}</mtext>`);
  }
}

/** The expression as MathML Core markup, without the enclosing `<math>`. */
export const toMathML = (e: Expr, o: MathMLOptions = {}): string => print(e, o).ml;
