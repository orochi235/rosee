import type { Vec2 } from '../../machine/pose';

/** Segments a circle, arc, ellipse or spline is flattened to per turn or span. */
const STEPS = 256;

type Group = [code: number, value: string];

function groups(text: string): Group[] {
  const lines = text.split(/\r?\n/);
  const out: Group[] = [];
  for (let k = 0; k + 1 < lines.length; k += 2) {
    const code = Number(lines[k].trim());
    if (Number.isFinite(code)) out.push([code, lines[k + 1].trim()]);
  }
  return out;
}

/** Millimeters per drawing unit, from the header's $INSUNITS; a drawing that
 *  says nothing is read as millimeters. */
function unitOf(g: Group[]): number {
  const k = g.findIndex(([c, v]) => c === 9 && v === '$INSUNITS');
  if (k < 0) return 1;
  const units = Number(g[k + 1]?.[1]);
  const mm: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 8: 25.4e-6, 9: 0.0254, 10: 914.4, 13: 1e-3, 14: 100 };
  return mm[units] ?? 1;
}

interface Entity {
  type: string;
  codes: Group[];
}

/** The ENTITIES section, entity by entity. */
function entities(g: Group[]): Entity[] {
  const out: Entity[] = [];
  let inEntities = false;
  let current: Entity | null = null;
  for (let k = 0; k < g.length; k++) {
    const [c, v] = g[k];
    if (c === 2 && g[k - 1]?.[0] === 0 && g[k - 1][1] === 'SECTION') inEntities = v === 'ENTITIES';
    if (!inEntities) continue;
    if (c === 0) {
      if (current) out.push(current);
      current = v === 'ENDSEC' ? null : { type: v, codes: [] };
      if (v === 'ENDSEC') inEntities = false;
    } else current?.codes.push([c, v]);
  }
  if (current) out.push(current);
  return out;
}

const first = (e: Entity, code: number, fallback = 0) => {
  const hit = e.codes.find(([c]) => c === code);
  return hit ? Number(hit[1]) : fallback;
};
const all = (e: Entity, code: number) => e.codes.filter(([c]) => c === code).map(([, v]) => Number(v));

/** The points after `a` along a polyline segment to `b` bulged by `bulge`
 *  (the tangent of a quarter of its arc's angle, positive anticlockwise). */
function bulged(a: Vec2, b: Vec2, bulge: number): Vec2[] {
  if (bulge === 0) return [b];
  const theta = 4 * Math.atan(bulge);
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const radius = chord / (2 * Math.sin(theta / 2));
  const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const toCenter = radius * Math.cos(theta / 2);
  const [nx, ny] = [-(b[1] - a[1]) / chord, (b[0] - a[0]) / chord];
  const c: Vec2 = [mid[0] + nx * toCenter, mid[1] + ny * toCenter];
  const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  const steps = Math.max(2, Math.ceil((Math.abs(theta) / (2 * Math.PI)) * STEPS));
  const r = Math.abs(radius);
  return Array.from({ length: steps }, (_, s) => {
    const t = a0 + (theta * (s + 1)) / steps;
    return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
  });
}

function polyline(vertices: { p: Vec2; bulge: number }[], closed: boolean): Vec2[] {
  const out: Vec2[] = [vertices[0].p];
  const n = vertices.length;
  for (let k = 0; k < (closed ? n : n - 1); k++) out.push(...bulged(vertices[k].p, vertices[(k + 1) % n].p, vertices[k].bulge));
  if (closed) out.pop();
  return out;
}

function arc(cx: number, cy: number, r: number, from: number, to: number): Vec2[] {
  let span = to - from;
  if (span <= 0) span += 2 * Math.PI;
  const steps = Math.max(2, Math.ceil((span / (2 * Math.PI)) * STEPS));
  return Array.from({ length: steps + 1 }, (_, s) => {
    const t = from + (span * s) / steps;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  });
}

/** A B-spline's points by de Boor's algorithm; weights are ignored. */
function spline(degree: number, knots: number[], control: Vec2[]): Vec2[] {
  const n = control.length;
  if (n <= degree || knots.length !== n + degree + 1) return control;
  const lo = knots[degree];
  const hi = knots[n];
  const steps = STEPS * Math.max(1, n - degree);
  const out: Vec2[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = Math.min(lo + ((hi - lo) * s) / steps, hi - 1e-12);
    let k = degree;
    while (k < n - 1 && knots[k + 1] <= t) k++;
    const d = Array.from({ length: degree + 1 }, (_, j) => [...control[j + k - degree]] as [number, number]);
    for (let r = 1; r <= degree; r++) {
      for (let j = degree; j >= r; j--) {
        const i = j + k - degree;
        const den = knots[i + degree - r + 1] - knots[i];
        const a = den === 0 ? 0 : (t - knots[i]) / den;
        d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1]];
      }
    }
    out.push(d[degree]);
  }
  return out;
}

/** Open pieces joined end to end into closed loops, where their ends meet
 *  within `tolerance`; pieces that close no loop are dropped. */
function chain(pieces: Vec2[][], tolerance: number): Vec2[][] {
  const loops: Vec2[][] = [];
  const left = [...pieces];
  const near = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
  while (left.length) {
    let loop = left.pop()!;
    let grew = true;
    while (grew && !near(loop[0], loop[loop.length - 1])) {
      grew = false;
      for (let k = 0; k < left.length; k++) {
        const p = left[k];
        const end = loop[loop.length - 1];
        if (near(end, p[0])) loop = [...loop, ...p.slice(1)];
        else if (near(end, p[p.length - 1])) loop = [...loop, ...[...p].reverse().slice(1)];
        else continue;
        left.splice(k, 1);
        grew = true;
        break;
      }
    }
    if (near(loop[0], loop[loop.length - 1]) && loop.length > 3) loops.push(loop.slice(0, -1));
  }
  return loops;
}

/** Every closed outline in an ASCII DXF drawing, in mm: polylines (bulges
 *  included), circles, ellipses and splines, and lines and arcs chained into
 *  loops where their ends meet. */
export function dxfLoops(text: string): Vec2[][] {
  const g = groups(text);
  const mm = unitOf(g);
  const loops: Vec2[][] = [];
  const open: Vec2[][] = [];
  const list = entities(g);
  for (let k = 0; k < list.length; k++) {
    const e = list[k];
    switch (e.type) {
      case 'LWPOLYLINE': {
        const xs = all(e, 10);
        const ys = all(e, 20);
        // A bulge belongs to the vertex before it.
        const bulges: number[] = [];
        let v = -1;
        for (const [c, val] of e.codes) {
          if (c === 10) v++;
          if (c === 42 && v >= 0) bulges[v] = Number(val);
        }
        const verts = xs.map((x, j) => ({ p: [x, ys[j]] as Vec2, bulge: bulges[j] ?? 0 }));
        if (verts.length < 2) break;
        const closed = (first(e, 70) & 1) === 1;
        (closed ? loops : open).push(polyline(verts, closed));
        break;
      }
      case 'POLYLINE': {
        const verts: { p: Vec2; bulge: number }[] = [];
        while (list[k + 1]?.type === 'VERTEX') {
          const v = list[++k];
          verts.push({ p: [first(v, 10), first(v, 20)], bulge: first(v, 42) });
        }
        if (verts.length < 2) break;
        const closed = (first(e, 70) & 1) === 1;
        (closed ? loops : open).push(polyline(verts, closed));
        break;
      }
      case 'CIRCLE': {
        const pts = arc(first(e, 10), first(e, 20), first(e, 40), 0, 2 * Math.PI);
        loops.push(pts.slice(0, -1));
        break;
      }
      case 'ARC':
        open.push(arc(first(e, 10), first(e, 20), first(e, 40), (first(e, 50) * Math.PI) / 180, (first(e, 51) * Math.PI) / 180));
        break;
      case 'LINE':
        open.push([
          [first(e, 10), first(e, 20)],
          [first(e, 11), first(e, 21)],
        ]);
        break;
      case 'ELLIPSE': {
        const [cx, cy, mx, my] = [first(e, 10), first(e, 20), first(e, 11), first(e, 21)];
        const ratio = first(e, 40, 1);
        const [t0, t1] = [first(e, 41, 0), first(e, 42, 2 * Math.PI)];
        let span = t1 - t0;
        if (span <= 0) span += 2 * Math.PI;
        const pts = Array.from({ length: STEPS + 1 }, (_, s): Vec2 => {
          const t = t0 + (span * s) / STEPS;
          const [a, b] = [Math.cos(t), ratio * Math.sin(t)];
          return [cx + a * mx - b * my, cy + a * my + b * mx];
        });
        if (Math.abs(span - 2 * Math.PI) < 1e-9) loops.push(pts.slice(0, -1));
        else open.push(pts);
        break;
      }
      case 'SPLINE': {
        const control = all(e, 10).map((x, j): Vec2 => [x, all(e, 20)[j]]);
        const fit = all(e, 11).map((x, j): Vec2 => [x, all(e, 21)[j]]);
        const pts = control.length > 0 ? spline(first(e, 71, 3), all(e, 40), control) : fit;
        if (pts.length < 2) break;
        const closed = (first(e, 70) & 1) === 1;
        (closed ? loops : open).push(closed ? pts.slice(0, -1) : pts);
        break;
      }
    }
  }
  let size = 0;
  for (const p of [...loops, ...open].flat()) size = Math.max(size, Math.abs(p[0]), Math.abs(p[1]));
  loops.push(...chain(open, Math.max(size, 1) * 1e-6));
  return loops.map((loop) => loop.map(([x, y]): Vec2 => [x * mm, y * mm]));
}
