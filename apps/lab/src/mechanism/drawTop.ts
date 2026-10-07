import { type Rubber, rubberReach, type Vec2 } from 'rosee';
import type { Palette } from '../palette';
import { drawTrail, type Trail } from './drawTrail';
import { type MachinePose, workToMachine } from './pose';

export interface Frame {
  /** Machine-frame point at the canvas center, mm. */
  center: Vec2;
  /** CSS pixels per mm. */
  scale: number;
}

/** Machine-frame mm to canvas CSS pixels, for drawing and for hit tests. */
export function toCanvas(frame: Frame, size: { width: number; height: number }) {
  return (p: Vec2): Vec2 => [
    size.width / 2 + (p[0] - frame.center[0]) * frame.scale,
    size.height / 2 - (p[1] - frame.center[1]) * frame.scale,
  ];
}

/** The machine seen along the spindle: rosette on the rocking headstock,
 *  rubber fixed to the bed, the stock and the cutter; on a straight-line
 *  engine the plate on its carriage and the rails; the cut so far on the work
 *  when `trail` is given. True geometry. */
export function drawTop(
  ctx: CanvasRenderingContext2D,
  pose: MachinePose,
  rubber: Rubber,
  frame: Frame,
  size: { width: number; height: number; dpr: number },
  c: Palette,
  trail: Trail | null = null,
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

  const chuck = pose.chuck;
  if (chuck?.ring) {
    ctx.strokeStyle = c.faint;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(X(chuck.ring), Y(chuck.ring), chuck.ringRadius * frame.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = c.faint;
    ctx.beginPath();
    ctx.arc(X(chuck.ring), Y(chuck.ring), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const polygon = (points: Vec2[]) => {
    ctx.beginPath();
    points.forEach((p, k) => (k === 0 ? ctx.moveTo(X(p), Y(p)) : ctx.lineTo(X(p), Y(p))));
    ctx.closePath();
  };
  const carriage = pose.carriage;
  if (carriage) {
    ctx.strokeStyle = c.steel;
    ctx.lineWidth = 3;
    for (const [a, b] of carriage.rails) {
      ctx.beginPath();
      ctx.moveTo(X(a), Y(a));
      ctx.lineTo(X(b), Y(b));
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    polygon(carriage.corners);
    ctx.fillStyle = c.stock;
    ctx.fill();
    ctx.stroke();
    polygon(carriage.plateCorners);
    ctx.fill();
  } else {
    ctx.fillStyle = c.stock;
    ctx.beginPath();
    ctx.arc(X(pose.work), Y(pose.work), pose.stock * frame.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  if (chuck) {
    ctx.strokeStyle = c.steel;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X(chuck.ends[0]), Y(chuck.ends[0]));
    ctx.lineTo(X(chuck.ends[1]), Y(chuck.ends[1]));
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  if (trail) {
    const onWork = workToMachine(pose);
    drawTrail(ctx, trail, (p) => at(onWork(p)), c);
  }

  ctx.strokeStyle = c.rosette;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  pose.rosette.forEach((p, k) => (k === 0 ? ctx.moveTo(X(p), Y(p)) : ctx.lineTo(X(p), Y(p))));
  ctx.stroke();

  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.arc(X(pose.spindle), Y(pose.spindle), 2.5, 0, Math.PI * 2);
  ctx.fill();

  if (chuck) {
    ctx.fillStyle = c.work;
    ctx.beginPath();
    ctx.arc(X(pose.work), Y(pose.work), 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = c.rubber;
  ctx.fillStyle = c.rubber;
  ctx.lineWidth = 1.5;
  const reach = rubberReach(rubber);
  ctx.beginPath();
  if (rubber.shape === 'round') {
    ctx.arc(X([pose.rubberX, 0]), Y([pose.rubberX, 0]), Math.max(reach * frame.scale, 1.5), 0, Math.PI * 2);
  } else {
    ctx.moveTo(X([pose.rubberX, -reach]), Y([pose.rubberX, -reach]));
    ctx.lineTo(X([pose.rubberX, reach]), Y([pose.rubberX, reach]));
  }
  ctx.stroke();

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
