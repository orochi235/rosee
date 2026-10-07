import { type Rubber, rubberReach, type Vec2 } from 'rosee';
import { type Frame, toCanvas } from './drawTop';
import type { PartKey } from './parts';
import type { MachinePose } from './pose';

/** How close, in CSS pixels, a pointer must be to a thin part to pick it. */
const REACH = 6;

function toSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** The part of the top view under canvas point `p`, smallest parts first so
 *  the rubber wins over the rosette it sits on. */
export function pickTop(
  pose: MachinePose,
  rubber: Rubber,
  frame: Frame,
  size: { width: number; height: number },
  p: Vec2,
): PartKey | null {
  const at = toCanvas(frame, size);
  const rubberAt = at([pose.rubberX, 0]);
  const reach = rubberReach(rubber);
  if (rubber.shape === 'round') {
    if (Math.hypot(p[0] - rubberAt[0], p[1] - rubberAt[1]) <= reach * frame.scale + REACH) return 'rubber';
  } else if (toSegment(p, at([pose.rubberX, -reach]), at([pose.rubberX, reach])) <= REACH) {
    return 'rubber';
  }
  const cutter = at(pose.cutter);
  if (p[0] >= cutter[0] - 2 && p[0] <= cutter[0] + 11 && Math.abs(p[1] - cutter[1]) <= 7) return 'cutter';
  const spindle = at(pose.spindle);
  if (Math.hypot(p[0] - spindle[0], p[1] - spindle[1]) <= REACH) return 'spindle';
  const ch = pose.chuck;
  if (ch?.ring) {
    const [rx, ry] = at(ch.ring);
    const d = Math.hypot(p[0] - rx, p[1] - ry);
    if (d <= REACH || Math.abs(d - ch.ringRadius * frame.scale) <= REACH) return 'ring';
  }
  for (let k = 1; k < pose.rosette.length; k++) {
    if (toSegment(p, at(pose.rosette[k - 1]), at(pose.rosette[k])) <= REACH) return 'rosette';
  }
  if (pose.chuck && toSegment(p, at(pose.chuck.ends[0]), at(pose.chuck.ends[1])) <= REACH) return 'chuck';
  const work = at(pose.work);
  if (Math.hypot(p[0] - work[0], p[1] - work[1]) <= pose.stock * frame.scale) return 'work';
  if (toSegment(p, at(pose.pivot), spindle) <= REACH) return 'headstock';
  return null;
}
