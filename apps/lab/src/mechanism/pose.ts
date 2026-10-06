import { headstockToMachine, machineToHeadstock, rad, radiusAt, type Settings, TAU, type Toolpaths, type Vec2 } from 'rosee';
import type { PlayheadAt } from '../playhead';

/** The machine at one instant, in machine-frame mm, ready to draw. */
export interface MachinePose {
  pivot: Vec2;
  spindle: Vec2;
  /** The rosette's outline, closed. */
  rosette: Vec2[];
  /** The outline point the rubber touches. */
  contact: Vec2;
  steep: boolean;
  rubberX: number;
  cutter: Vec2;
  swing: number;
  pump: number;
  /** The rosette's phase against the work for this pass, radians. */
  phase: number;
  /** The stock's radius, drawn around the spindle. */
  stock: number;
}

const OUTLINE_POINTS = 720;

export function machinePose(s: Settings, t: Toolpaths, at: PlayheadAt): MachinePose {
  const path = t.passes[at.pass];
  const i = at.sample;
  const swing = path.swing[i];
  const P = s.pivotDistance;
  const rosetteAngle = at.angle + rad(path.pass.phase);
  const toMachine = (local: number): Vec2 => {
    const r = radiusAt(s.rosette, local);
    const a = local + rosetteAngle;
    return headstockToMachine([r * Math.cos(a), r * Math.sin(a)], P, swing);
  };
  const rosette: Vec2[] = [];
  for (let k = 0; k <= OUTLINE_POINTS; k++) rosette.push(toMachine((k / OUTLINE_POINTS) * TAU));
  return {
    pivot: [0, -P],
    spindle: headstockToMachine([0, 0], P, swing),
    rosette,
    contact: toMachine(path.contact[i]),
    steep: path.steep[i] === 1,
    rubberX: t.rubberX,
    cutter: [path.pass.radius, 0],
    swing,
    pump: path.pump[i],
    phase: rad(path.pass.phase),
    stock: Math.max(s.job.from, s.job.to) + 1,
  };
}

/** Where the rubber's center is drawn when the swing is magnified
 *  `exaggerate` times: moved with the contact point, so the rubber stays on
 *  the swung rosette instead of the rosette passing through it. */
export function followingRubber(pose: MachinePose, pivotDistance: number, exaggerate: number): Vec2 {
  const local = machineToHeadstock(pose.contact, pivotDistance, pose.swing);
  const [x, y] = headstockToMachine(local, pivotDistance, pose.swing * exaggerate);
  return [pose.rubberX + x - pose.contact[0], y - pose.contact[1]];
}
