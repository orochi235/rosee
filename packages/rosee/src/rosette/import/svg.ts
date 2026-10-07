import type { Vec2 } from '../../machine/pose';

/** An affine transform [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
type Affine = [number, number, number, number, number, number];

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

const compose = (m: Affine, n: Affine): Affine => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const apply = (m: Affine, [x, y]: Vec2): Vec2 => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

const numbers = (s: string): number[] => (s.match(NUMBER) ?? []).map(Number);

function parseTransform(s: string | undefined): Affine {
  let m = IDENTITY;
  if (!s) return m;
  for (const [, name, args] of s.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const v = numbers(args);
    let n: Affine = IDENTITY;
    switch (name) {
      case 'matrix':
        n = [v[0], v[1], v[2], v[3], v[4], v[5]];
        break;
      case 'translate':
        n = [1, 0, 0, 1, v[0], v[1] ?? 0];
        break;
      case 'scale':
        n = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
        break;
      case 'rotate': {
        const a = (v[0] * Math.PI) / 180;
        const r: Affine = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
        n = v.length >= 3 ? compose(compose([1, 0, 0, 1, v[1], v[2]], r), [1, 0, 0, 1, -v[1], -v[2]]) : r;
        break;
      }
      case 'skewX':
        n = [1, 0, Math.tan((v[0] * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        n = [1, Math.tan((v[0] * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    m = compose(m, n);
  }
  return m;
}

/** Segments each curve or arc is flattened to. */
const CURVE_STEPS = 48;

/** An SVG arc's points after its start, from the endpoint parameters (SVG
 *  1.1, appendix F.6). */
function arcPoints(p0: Vec2, rx: number, ry: number, angle: number, large: boolean, sweep: boolean, p1: Vec2): Vec2[] {
  if (rx === 0 || ry === 0) return [p1];
  const phi = (angle * Math.PI) / 180;
  const [cp, sp] = [Math.cos(phi), Math.sin(phi)];
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const x1 = cp * dx + sp * dy;
  const y1 = -sp * dx + cp * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const grow = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (grow > 1) {
    rx *= Math.sqrt(grow);
    ry *= Math.sqrt(grow);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (k * rx * y1) / ry;
  const cy1 = (-k * ry * x1) / rx;
  const cx = cp * cx1 - sp * cy1 + (p0[0] + p1[0]) / 2;
  const cy = sp * cx1 + cp * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t0 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const out: Vec2[] = [];
  for (let s = 1; s <= CURVE_STEPS; s++) {
    const t = t0 + (dt * s) / CURVE_STEPS;
    const [x, y] = [rx * Math.cos(t), ry * Math.sin(t)];
    out.push([cp * x - sp * y + cx, sp * x + cp * y + cy]);
  }
  return out;
}

const cubic = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2[] =>
  Array.from({ length: CURVE_STEPS }, (_, s) => {
    const t = (s + 1) / CURVE_STEPS;
    const u = 1 - t;
    return [
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
    ];
  });

const quadratic = (a: Vec2, b: Vec2, c: Vec2): Vec2[] =>
  cubic(a, [a[0] + (2 / 3) * (b[0] - a[0]), a[1] + (2 / 3) * (b[1] - a[1])], [c[0] + (2 / 3) * (b[0] - c[0]), c[1] + (2 / 3) * (b[1] - c[1])], c);

/** A path's `d` as polylines, one per subpath. */
export function pathLoops(d: string): Vec2[][] {
  const loops: Vec2[][] = [];
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  let k = 0;
  let cmd = '';
  let cur: Vec2 = [0, 0];
  let start: Vec2 = [0, 0];
  let lastControl: Vec2 | null = null;
  let lastQuad: Vec2 | null = null;
  let line: Vec2[] = [];
  const flush = () => {
    if (line.length >= 3) loops.push(line);
    line = [];
  };
  const next = () => Number(tokens[k++]);
  const flag = () => {
    // Arc flags may run into the next number with no separator: "a1 1 0 01.5.5".
    const t = tokens[k];
    if (t.length > 1 && (t[0] === '0' || t[0] === '1')) {
      tokens[k] = t.slice(1);
      return t[0] === '1';
    }
    k++;
    return t === '1';
  };
  while (k < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[k])) cmd = tokens[k++];
    const rel = cmd === cmd.toLowerCase();
    const pt = (): Vec2 => {
      const x = next();
      const y = next();
      return rel ? [cur[0] + x, cur[1] + y] : [x, y];
    };
    const C = cmd.toUpperCase();
    let reflected: Vec2 | null = null;
    switch (C) {
      case 'M': {
        flush();
        cur = pt();
        start = cur;
        line = [cur];
        // Pairs after a moveto are linetos.
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L':
        cur = pt();
        line.push(cur);
        break;
      case 'H':
        cur = [rel ? cur[0] + next() : next(), cur[1]];
        line.push(cur);
        break;
      case 'V':
        cur = [cur[0], rel ? cur[1] + next() : next()];
        line.push(cur);
        break;
      case 'C': {
        const [b, c, e] = [pt(), pt(), pt()];
        line.push(...cubic(cur, b, c, e));
        reflected = c;
        cur = e;
        break;
      }
      case 'S': {
        const b: Vec2 = lastControl ? [2 * cur[0] - lastControl[0], 2 * cur[1] - lastControl[1]] : cur;
        const [c, e] = [pt(), pt()];
        line.push(...cubic(cur, b, c, e));
        reflected = c;
        cur = e;
        break;
      }
      case 'Q': {
        const [b, e] = [pt(), pt()];
        line.push(...quadratic(cur, b, e));
        lastQuad = b;
        cur = e;
        break;
      }
      case 'T': {
        const b: Vec2 = lastQuad ? [2 * cur[0] - lastQuad[0], 2 * cur[1] - lastQuad[1]] : cur;
        const e = pt();
        line.push(...quadratic(cur, b, e));
        lastQuad = b;
        cur = e;
        break;
      }
      case 'A': {
        const [rx, ry, angle] = [next(), next(), next()];
        const large = flag();
        const sweep = flag();
        const e = pt();
        line.push(...arcPoints(cur, rx, ry, angle, large, sweep, e));
        cur = e;
        break;
      }
      case 'Z':
        cur = start;
        flush();
        line = [cur];
        break;
      default:
        // An unknown command: skip its token so parsing moves on.
        k++;
    }
    lastControl = reflected;
    if (C !== 'Q' && C !== 'T') lastQuad = null;
  }
  flush();
  return loops;
}

const ellipse = (cx: number, cy: number, rx: number, ry: number): Vec2[] =>
  Array.from({ length: 256 }, (_, k) => [cx + rx * Math.cos((k / 256) * 2 * Math.PI), cy + ry * Math.sin((k / 256) * 2 * Math.PI)]);

/** Millimeters per unit of a length such as "210mm" or "8.5in"; null for a
 *  bare number or px. */
function mmPer(length: string | undefined): { value: number; mm: number } | null {
  if (!length) return null;
  const m = length.trim().match(/^([-+]?[\d.]+(?:e[-+]?\d+)?)\s*(mm|cm|in|pt|pc|px)?$/i);
  if (!m) return null;
  const unit = (m[2] ?? 'px').toLowerCase();
  const per: Record<string, number> = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96 };
  return { value: Number(m[1]), mm: per[unit] };
}

/** Every closed shape in an SVG document as a loop in mm, y up: paths,
 *  polygons, circles, ellipses and rects, with their transforms. A document
 *  sized in mm (or in, cm, pt) keeps its size; one in px is read at 96 per
 *  inch. */
export function svgLoops(text: string): Vec2[][] {
  const loops: Vec2[][] = [];
  const stack: Affine[] = [IDENTITY];
  let root: Affine | null = null;
  for (const [, close, tag, body, selfClose] of text.matchAll(/<\s*(\/)?\s*([a-zA-Z][\w:.-]*)([^>]*?)(\/)?\s*>/g)) {
    if (close) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const [, k, , dq, sq] of body.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[k] = dq ?? sq;
    const name = tag.replace(/^.*:/, '');
    let m = compose(stack[stack.length - 1], parseTransform(attrs.transform));
    if (name === 'svg' && root === null) {
      // The root's viewBox maps user units to its width and height.
      const box = attrs.viewBox ? numbers(attrs.viewBox) : null;
      const w = mmPer(attrs.width);
      const unit = w && box && box[2] > 0 ? (w.value * w.mm) / box[2] : w && !box ? w.mm : 25.4 / 96;
      root = [unit, 0, 0, -unit, box ? -box[0] * unit : 0, box ? box[1] * unit : 0];
      m = compose(root, m);
    }
    const n = (k: string) => Number(attrs[k] ?? 0);
    let shapes: Vec2[][] = [];
    switch (name) {
      case 'path':
        shapes = pathLoops(attrs.d ?? '');
        break;
      case 'polygon':
      case 'polyline': {
        const v = numbers(attrs.points ?? '');
        shapes = [Array.from({ length: Math.floor(v.length / 2) }, (_, k): Vec2 => [v[2 * k], v[2 * k + 1]])];
        break;
      }
      case 'circle':
        shapes = [ellipse(n('cx'), n('cy'), n('r'), n('r'))];
        break;
      case 'ellipse':
        shapes = [ellipse(n('cx'), n('cy'), n('rx'), n('ry'))];
        break;
      case 'rect': {
        const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
        shapes = [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]];
        break;
      }
    }
    for (const s of shapes) loops.push(s.map((p) => apply(m, p)));
    if (!selfClose) stack.push(m);
  }
  return loops;
}
