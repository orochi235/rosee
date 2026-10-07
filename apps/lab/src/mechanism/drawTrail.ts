import type { Vec2 } from 'rosee';
import type { Palette } from '../palette';

/** The cut so far, as `cutPath` lays it and `cutTo` ends it, with how many
 *  points make a turn. */
export interface Trail {
  xyz: Float32Array;
  end: number;
  perTurn: number;
}

/** Color steps across the fresh turn; the 3D trail shades per segment. */
const STEPS = 24;

const rgb = (hex: string) => [1, 3, 5].map((k) => Number.parseInt(hex.slice(k, k + 2), 16));

/** The cut on the work seen down the spindle, carried by the work to where it
 *  sits now: `trailOld`, shading to `trailNew` over the last turn at the graver,
 *  as the 3D machine draws it. */
export function drawTrail(ctx: CanvasRenderingContext2D, trail: Trail, toCanvas: (work: Vec2) => Vec2, c: Palette) {
  const { xyz, perTurn } = trail;
  const end = Math.min(trail.end, xyz.length / 3 - 1);
  if (end < 1) return;
  const span = Math.max(1, perTurn);
  const stroke = (from: number, to: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let k = from; k <= to; k++) {
      const [x, y] = toCanvas([xyz[k * 3], xyz[k * 3 + 1]]);
      if (k === from) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  ctx.lineWidth = 1;
  const fresh = Math.max(0, end - span);
  if (fresh > 0) stroke(0, fresh, c.trailOld);
  const [a, b] = [rgb(c.trailNew), rgb(c.trailOld)];
  for (let s = 0; s < STEPS; s++) {
    const from = fresh + Math.floor(((end - fresh) * s) / STEPS);
    const to = fresh + Math.floor(((end - fresh) * (s + 1)) / STEPS);
    if (to <= from) continue;
    const t = Math.min(1, (end - (from + to) / 2) / span);
    stroke(from, to, `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(' ')})`);
  }
}
