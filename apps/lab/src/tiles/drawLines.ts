import { sheetPeriod, sheetRuns, type Toolpaths } from 'rosee';
import type { View } from 'rosee/gl';
import type { PlayheadAt } from '../playhead';

/** The toolpaths on their sheet as lines, cut up to the playhead, with the
 *  cutter marked. A pass round a barrel breaks at the seam.
 *  A null background leaves the canvas transparent behind them. */
export function drawLines(
  ctx: CanvasRenderingContext2D,
  t: Toolpaths,
  upTo: PlayheadAt,
  view: View,
  size: { width: number; height: number; dpr: number },
  colors: { line: string; cutter: string; background: string | null },
) {
  const { width, height, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (colors.background) {
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);
  }
  const toX = (x: number) => width / 2 + (x - view.center[0]) / view.mmPerPixel;
  const toY = (y: number) => height / 2 - (y - view.center[1]) / view.mmPerPixel;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 0.75;
  const period = sheetPeriod(t.surface);
  for (let k = 0; k <= upTo.pass; k++) {
    const uvh = t.passes[k].uvh;
    const last = k === upTo.pass ? upTo.sample : t.samples;
    ctx.beginPath();
    for (const [first, end] of sheetRuns(uvh, last + 1, period)) {
      ctx.moveTo(toX(uvh[first * 3]), toY(uvh[first * 3 + 1]));
      for (let i = first + 1; i <= end; i++) ctx.lineTo(toX(uvh[i * 3]), toY(uvh[i * 3 + 1]));
    }
    ctx.stroke();
  }
  const p = t.passes[upTo.pass];
  if (p) {
    const i = upTo.sample;
    ctx.fillStyle = colors.cutter;
    ctx.beginPath();
    ctx.arc(toX(p.uvh[i * 3]), toY(p.uvh[i * 3 + 1]), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
