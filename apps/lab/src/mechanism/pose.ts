import {
  type Chuck,
  chuckToHeadstock,
  headstockToMachine,
  machineToHeadstock,
  rad,
  radiusAt,
  type Settings,
  TAU,
  type Toolpaths,
  type Vec2,
  wheelOf,
} from 'rosee';
import type { PlayheadAt } from '../playhead';

/** The chuck at one instant, machine frame. */
export interface ChuckPose {
  kind: Chuck['kind'];
  /** The work's offset along the slide, mm. */
  slide: number;
  /** The wheel's turn, radians. */
  wheel: number;
  /** The slide's two ends. */
  ends: [Vec2, Vec2];
  /** The elliptical chuck's ring center; null on an eccentric chuck. */
  ring: Vec2 | null;
  /** The ring's radius, wider than the stock so it shows past the work. */
  ringRadius: number;
}

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
  /** The stock's radius, drawn around the work center. */
  stock: number;
  /** The work's center. */
  work: Vec2;
  /** The chuck slide's direction round the headstock, radians: spindle − index. */
  slideAngle: number;
  chuck: ChuckPose | null;
}

const OUTLINE_POINTS = 720;

const stocks = new WeakMap<Toolpaths, number>();

/** The stock's radius: wide enough for every pass's cut at its largest eccentricity. */
function stockRadius(s: Settings, t: Toolpaths): number {
  let stock = stocks.get(t);
  if (stock === undefined) {
    const c = s.chuck;
    const eccentricity = c ? Math.max(...t.passes.map((q) => Math.abs(c.eccentricity + q.pass.eccentricity))) : 0;
    stock = Math.max(s.job.from, s.job.to) + eccentricity + 1;
    stocks.set(t, stock);
  }
  return stock;
}

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
  const index = rad(path.pass.index);
  const onHeadstock = (p: Vec2) => headstockToMachine(chuckToHeadstock(p, at.angle, index), P, swing);
  const slide = path.slide[i];
  const c = s.chuck;
  const stock = stockRadius(s, t);
  const e = c ? c.eccentricity + path.pass.eccentricity : 0;
  const chuck: ChuckPose | null = c && {
    kind: c.kind,
    slide,
    wheel: wheelOf(c, path.pass),
    ends: [onHeadstock([-stock, 0]), onHeadstock([stock, 0])],
    ring:
      c.kind === 'elliptical'
        ? headstockToMachine([e * Math.cos(rad(c.ring)), e * Math.sin(rad(c.ring))], P, swing)
        : null,
    ringRadius: stock * 1.25,
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
    stock,
    work: onHeadstock([slide, 0]),
    slideAngle: at.angle - index,
    chuck,
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
