import type { Surface } from 'rosee';
import type { Palette } from '../palette';
import type { MachinePose } from './pose';

/** The stock's outline in the side view's plane, (x up from the spindle
 *  axis, z along it) in mm, with its face or pole at z = 0. `back` is how
 *  far a face's stock is drawn behind it. */
function profile(surface: Surface, stock: number, back: number): [number, number][] {
  switch (surface.kind) {
    case 'flat':
      return [[stock, 0], [-stock, 0], [-stock, -back], [stock, -back]];
    case 'cylinder': {
      const { radius: R, length: L } = surface;
      return [[R, 0], [-R, 0], [-R, -L], [R, -L]];
    }
    case 'dome': {
      const S = surface.radius;
      const top = Math.asin(Math.min(1, surface.rim / S));
      const rimZ = -S + S * Math.cos(top);
      const cap: [number, number][] = [];
      for (let k = -24; k <= 24; k++) {
        const g = (k / 24) * top;
        cap.push([S * Math.sin(g), -S + S * Math.cos(g)]);
      }
      return [...cap, [surface.rim, rimZ - back], [-surface.rim, rimZ - back]];
    }
  }
}

/** The headstock from the side, sliding along the spindle as it pumps, with
 *  the stock's profile and the graver set against it. Travel is magnified by
 *  `exaggerate`; the stock and graver are to scale with each other, the rest
 *  schematic. */
export function drawSide(
  ctx: CanvasRenderingContext2D,
  pose: MachinePose,
  surface: Surface,
  pumping: boolean,
  exaggerate: number,
  size: { width: number; height: number; dpr: number },
  c: Palette,
) {
  const { width, height, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = c.background;
  ctx.fillRect(0, 0, width, height);
  const mid = height / 2;
  const unit = Math.min(width / 140, height / 70);
  const rest = width * 0.62;
  const outline = profile(surface, pose.stock, 0);
  const deepest = Math.min(...outline.map(([, z]) => z));
  const length = surface.kind === 'cylinder' ? surface.length : 0;
  // mm to px: the stock 20 units tall, and a long barrel no longer than 60.
  const mm = unit * Math.min(10 / pose.stock, length > 0 ? 60 / length : Infinity);
  const back = surface.kind === 'cylinder' ? 0 : 12 * (unit / mm);
  const travel = pose.pump * exaggerate * unit;
  const X = (z: number) => rest + travel + z * mm;
  const Y = (x: number) => mid - x * mm;
  const behind = X(deepest - back);

  ctx.fillStyle = c.faint;
  ctx.fillRect(behind - 58 * unit, mid - 18 * unit, 45 * unit, 36 * unit);
  ctx.fillStyle = c.rosette;
  ctx.fillRect(behind - 10 * unit, mid - 14 * unit, 3 * unit, 28 * unit);
  ctx.fillStyle = c.stock;
  ctx.beginPath();
  profile(surface, pose.stock, back).forEach(([x, z], k) => (k === 0 ? ctx.moveTo(X(z), Y(x)) : ctx.lineTo(X(z), Y(x))));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = c.ink;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(width, mid);
  ctx.stroke();
  ctx.setLineDash([]);

  // The graver is fixed: its tip where the job set it, its body back along
  // the way it points.
  const { tip, points } = pose.graver;
  const [tx, ty] = [rest + tip[2] * mm, Y(tip[0])];
  const [ax, ay] = [-points[2], points[0]];
  const [bx, by] = [-ay, ax];
  ctx.fillStyle = c.cutter;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + (ax * 14 + bx * 4) * unit, ty + (ay * 14 + by * 4) * unit);
  ctx.lineTo(tx + (ax * 14 - bx * 4) * unit, ty + (ay * 14 - by * 4) * unit);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = c.ink;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(
    pumping ? `pump travel ${(pose.pump * 1000).toFixed(1)} µm, shown ×${exaggerate}` : 'no pumping rosette',
    12,
    height - 12,
  );
}
