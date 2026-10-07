import { TAU } from '../angle';

/** The stock's surface, in mm. A face is cut flat on; a barrel is a cylinder
 *  of `radius` and `length` along the spindle from the face; a dome is a cap
 *  of a sphere of `radius`, its pole on the spindle axis at the face, cut out
 *  to `rim` from the axis. */
export type Surface =
  | { kind: 'flat' }
  | { kind: 'cylinder'; radius: number; length: number }
  | { kind: 'dome'; radius: number; rim: number };

export const flatFace: Surface = { kind: 'flat' };

export type Vec3 = readonly [number, number, number];

/** The graver for one pass, machine frame, at rest: where its tip is, and
 *  the unit direction its V opens across. The work face is at z = 0 with the
 *  stock behind it, z negative. */
export interface Graver {
  tip: Vec3;
  opens: Vec3;
}

/** Where the job puts the graver for position `at` and depth `depth`: on a
 *  face `at` is the radius; on a barrel the distance along it from the face;
 *  on a dome the arc from the pole. The graver points into the stock, square
 *  to the surface, and opens across the direction the work moves past it. */
export function graverAt(s: Surface, at: number, depth: number): Graver {
  switch (s.kind) {
    case 'flat':
      return { tip: [at, 0, -depth], opens: [1, 0, 0] };
    case 'cylinder':
      return { tip: [s.radius - depth, 0, -at], opens: [0, 0, 1] };
    case 'dome': {
      const g = at / s.radius;
      const r = s.radius - depth;
      return { tip: [r * Math.sin(g), 0, -s.radius + r * Math.cos(g)], opens: [Math.cos(g), 0, -Math.sin(g)] };
    }
  }
}

/** A work-frame point on the sheet the surface unrolls to: (u, v) across it
 *  and h, the height above the uncut surface. A face is its own sheet; a
 *  barrel unrolls to u round it (wrapping at ±πR) and v along it; a dome
 *  maps by arc from the pole, keeping the direction round the axis. */
export function toSheet(s: Surface, x: number, y: number, z: number): [u: number, v: number, h: number] {
  switch (s.kind) {
    case 'flat':
      return [x, y, z];
    case 'cylinder':
      return [s.radius * Math.atan2(y, x), -z, Math.hypot(x, y) - s.radius];
    case 'dome': {
      const zc = z + s.radius;
      const across = Math.hypot(x, y);
      const arc = s.radius * Math.atan2(across, zc);
      const scale = across > 0 ? arc / across : 1;
      return [x * scale, y * scale, Math.hypot(across, zc) - s.radius];
    }
  }
}

/** The work-frame point at sheet point (u, v) and height h: `toSheet`'s
 *  inverse. */
export function fromSheet(s: Surface, u: number, v: number, h: number): Vec3 {
  switch (s.kind) {
    case 'flat':
      return [u, v, h];
    case 'cylinder': {
      const a = u / s.radius;
      const r = s.radius + h;
      return [r * Math.cos(a), r * Math.sin(a), -v];
    }
    case 'dome': {
      const arc = Math.hypot(u, v);
      const g = arc / s.radius;
      const r = s.radius + h;
      const k = arc > 0 ? (r * Math.sin(g)) / arc : 1;
      return [u * k, v * k, -s.radius + r * Math.cos(g)];
    }
  }
}

/** How far the sheet repeats in u: a barrel's circumference, 0 for a sheet
 *  that does not wrap. */
export const sheetPeriod = (s: Surface): number => (s.kind === 'cylinder' ? TAU * s.radius : 0);

/** The farthest `at` the stock has: the barrel's length, the dome's arc to
 *  its rim; Infinity on a face. */
export function reachOf(s: Surface): number {
  switch (s.kind) {
    case 'flat':
      return Infinity;
    case 'cylinder':
      return s.length;
    case 'dome':
      return s.radius * Math.asin(Math.min(1, s.rim / s.radius));
  }
}

/** Throws unless the surface's sizes make a solid. */
export function checkSurface(s: Surface): void {
  if (s.kind === 'flat') return;
  if (!(s.radius > 0)) throw new Error(`the ${s.kind === 'cylinder' ? 'barrel' : 'dome'}'s radius must be positive, got ${s.radius}`);
  if (s.kind === 'cylinder' && !(s.length > 0)) throw new Error(`the barrel's length must be positive, got ${s.length}`);
  if (s.kind === 'dome' && !(s.rim > 0 && s.rim <= s.radius))
    throw new Error(`the dome's rim must be from 0 to its radius, ${s.radius} mm, got ${s.rim}`);
}
