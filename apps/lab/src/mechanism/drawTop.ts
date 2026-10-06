import type { Rubber, Vec2 } from 'rosee';
import type { MachinePose } from './pose';

export interface Frame {
  /** Machine-frame point at the canvas center, mm. */
  center: Vec2;
  /** CSS pixels per mm. */
  scale: number;
}

export interface Palette {
  background: string;
  ink: string;
  faint: string;
  rosette: string;
  rubber: string;
  contact: string;
  steep: string;
  cutter: string;
  stock: string;
}

/** Machine-frame mm to canvas CSS pixels, for drawing and for hit tests. */
export function toCanvas(frame: Frame, size: { width: number; height: number }) {
  return (p: Vec2): Vec2 => [
    size.width / 2 + (p[0] - frame.center[0]) * frame.scale,
    size.height / 2 - (p[1] - frame.center[1]) * frame.scale,
  ];
}

/** The machine seen along the spindle: rosette on the rocking headstock,
 *  rubber fixed to the bed, the stock and the cutter. True geometry. */
export function drawTop(
  ctx: CanvasRenderingContext2D,
  pose: MachinePose,
  rubber: Rubber,
  frame: Frame,
  size: { width: number; height: number; dpr: number },
  c: Palette,
) {
  const { width, height, dpr } = size;
  const at = toCanvas(frame, size);
  const X = (p: Vec2) => at(p)[0];
  const Y = (p: Vec2) => at(p)[1];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = c.background;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1;

  // The headstock arm runs from the pivot, usually far below the frame.
  ctx.strokeStyle = c.faint;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(X(pose.pivot), Y(pose.pivot));
  ctx.lineTo(X(pose.spindle), Y(pose.spindle));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = c.stock;
  ctx.beginPath();
  ctx.arc(X(pose.spindle), Y(pose.spindle), pose.stock * frame.scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = c.rosette;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  pose.rosette.forEach((p, k) => (k === 0 ? ctx.moveTo(X(p), Y(p)) : ctx.lineTo(X(p), Y(p))));
  ctx.stroke();

  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.arc(X(pose.spindle), Y(pose.spindle), 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = c.rubber;
  ctx.fillStyle = c.rubber;
  ctx.lineWidth = 1.5;
  if (rubber.shape === 'round') {
    ctx.beginPath();
    ctx.arc(X([pose.rubberX, 0]), Y([pose.rubberX, 0]), Math.max(rubber.radius * frame.scale, 1.5), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(X([pose.rubberX, -rubber.width / 2]), Y([pose.rubberX, -rubber.width / 2]));
    ctx.lineTo(X([pose.rubberX, rubber.width / 2]), Y([pose.rubberX, rubber.width / 2]));
    ctx.stroke();
  }

  ctx.fillStyle = pose.steep ? c.steep : c.contact;
  ctx.beginPath();
  ctx.arc(X(pose.contact), Y(pose.contact), 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = c.cutter;
  const [cx, cy] = [X(pose.cutter), Y(pose.cutter)];
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 9, cy - 5);
  ctx.lineTo(cx + 9, cy + 5);
  ctx.closePath();
  ctx.fill();
}
