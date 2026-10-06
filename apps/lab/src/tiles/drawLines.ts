import type { Toolpaths } from 'rosee';
import type { View } from 'rosee/gl';
import type { PlayheadAt } from '../playhead';

/** The toolpaths as lines, cut up to the playhead, with the cutter marked. */
export function drawLines(
  ctx: CanvasRenderingContext2D,
  t: Toolpaths,
  upTo: PlayheadAt,
  view: View,
  size: { width: number; height: number; dpr: number },
  colors: { line: string; cutter: string; background: string },
) {
  const { width, height, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  const toX = (x: number) => width / 2 + (x - view.center[0]) / view.mmPerPixel;
  const toY = (y: number) => height / 2 - (y - view.center[1]) / view.mmPerPixel;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 0.75;
  for (let k = 0; k <= Math.min(upTo.pass, t.passes.length - 1); k++) {
    const xyz = t.passes[k].xyz;
    const last = k === upTo.pass ? upTo.sample : t.samples;
    ctx.beginPath();
    for (let i = 0; i <= last; i++) {
      const x = toX(xyz[i * 3]);
      const y = toY(xyz[i * 3 + 1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const p = t.passes[upTo.pass];
  if (p) {
    const i = Math.min(upTo.sample, t.samples);
    ctx.fillStyle = colors.cutter;
    ctx.beginPath();
    ctx.arc(toX(p.xyz[i * 3]), toY(p.xyz[i * 3 + 1]), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
