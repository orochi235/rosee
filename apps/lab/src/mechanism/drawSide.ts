import type { MachinePose } from './pose';
import type { Palette } from '../palette';

/** The headstock from the side, sliding along the spindle as it pumps.
 *  Travel is magnified by `exaggerate`; everything else is schematic. */
export function drawSide(
  ctx: CanvasRenderingContext2D,
  pose: MachinePose,
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
  const face = width * 0.62 + pose.pump * exaggerate * unit;

  ctx.fillStyle = c.faint;
  ctx.fillRect(face - 70 * unit, mid - 18 * unit, 45 * unit, 36 * unit);
  ctx.fillStyle = c.rosette;
  ctx.fillRect(face - 22 * unit, mid - 14 * unit, 3 * unit, 28 * unit);
  ctx.fillStyle = c.stock;
  ctx.fillRect(face - 12 * unit, mid - 10 * unit, 12 * unit, 20 * unit);
  ctx.strokeStyle = c.ink;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(width, mid);
  ctx.stroke();
  ctx.setLineDash([]);

  // The cutter is fixed; its tip marks where the face sits at rest.
  const rest = width * 0.62;
  ctx.fillStyle = c.cutter;
  ctx.beginPath();
  ctx.moveTo(rest, mid - 6 * unit);
  ctx.lineTo(rest + 14 * unit, mid - 10 * unit);
  ctx.lineTo(rest + 14 * unit, mid - 2 * unit);
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
