import {
  carriageToHeadstock,
  type Chuck,
  chuckToHeadstock,
  type Graver,
  graverAt,
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
  /** The graver's tip, machine frame, seen down the spindle. */
  cutter: Vec2;
  /** The graver in full: its tip, which way it points and opens. */
  graver: Graver;
  swing: number;
  pump: number;
  /** The rosette's phase against the work for this pass, radians. */
  phase: number;
  /** The stock's radius, drawn around the work center: the barrel's or the
   *  dome's rim on a curved surface. */
  stock: number;
  /** The work's center. */
  work: Vec2;
  /** The chuck slide's direction round the headstock, radians: spindle −
   *  index; on a straight-line engine, whose work does not turn, −index. */
  slideAngle: number;
  /** The work's offset in the chuck's frame, mm: along the slide on a rose
   *  engine, the carriage's travel turned into that frame on a straight-line one. */
  carrier: Vec2;
  chuck: ChuckPose | null;
  carriage: CarriagePose | null;
}

/** A straight-line engine's carriage at one instant. */
export interface CarriagePose {
  /** Its travel along the frame, mm. */
  travel: number;
  /** The plate's extent in the work frame, mm. */
  plate: { min: Vec2; max: Vec2 };
  /** The plate's corners, machine frame. */
  plateCorners: Vec2[];
  /** The carriage's corners, machine frame: square to the frame, wide enough
   *  for the plate at any index. */
  corners: Vec2[];
  /** How far either side of the arbor the rails run, and how long they are
   *  either side of the middle, mm, headstock frame. */
  railX: number;
  railHalf: number;
  /** The rails' ends, machine frame. */
  rails: [Vec2, Vec2][];
}

const OUTLINE_POINTS = 720;

const stocks = new WeakMap<Toolpaths, number>();
const plates = new WeakMap<Toolpaths, { min: Vec2; max: Vec2 }>();

/** Margin round the cut on a straight-line engine's plate, mm. */
const PLATE_MARGIN = 1.5;

/** The plate under a straight-line engine's cut: the cut's extent on the
 *  work, every pass and index, with a margin. */
function plateOf(t: Toolpaths): { min: Vec2; max: Vec2 } {
  let plate = plates.get(t);
  if (!plate) {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of t.passes)
      for (let i = 0; i < p.uvh.length; i += 3) {
        x0 = Math.min(x0, p.uvh[i]);
        x1 = Math.max(x1, p.uvh[i]);
        y0 = Math.min(y0, p.uvh[i + 1]);
        y1 = Math.max(y1, p.uvh[i + 1]);
      }
    plate = { min: [x0 - PLATE_MARGIN, y0 - PLATE_MARGIN], max: [x1 + PLATE_MARGIN, y1 + PLATE_MARGIN] };
    plates.set(t, plate);
  }
  return plate;
}

/** The farthest any plate corner reaches from the work's center, mm. */
const plateReach = ({ min, max }: { min: Vec2; max: Vec2 }): number =>
  Math.max(...[min[0], max[0]].flatMap((x) => [min[1], max[1]].map((y) => Math.hypot(x, y))));

/** The stock's radius: the barrel's or the dome's rim, or on a face wide
 *  enough for every pass's cut at its largest eccentricity. */
function stockRadius(s: Settings, t: Toolpaths): number {
  if (s.surface.kind === 'cylinder') return s.surface.radius;
  if (s.surface.kind === 'dome') return s.surface.rim;
  if (s.engine.kind === 'straight') return plateReach(plateOf(t));
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
  const straight = s.engine.kind === 'straight';
  const c = s.chuck;
  const stock = stockRadius(s, t);
  const graver = graverAt(s.surface, path.pass.at, path.pass.depth);
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
  const carriage = s.engine.kind === 'straight' ? carriagePose(s.engine.stroke, plateOf(t), slide, index, P, swing) : null;
  const rosette: Vec2[] = [];
  for (let k = 0; k <= OUTLINE_POINTS; k++) rosette.push(toMachine((k / OUTLINE_POINTS) * TAU));
  return {
    pivot: [0, -P],
    spindle: headstockToMachine([0, 0], P, swing),
    rosette,
    contact: toMachine(path.contact[i]),
    steep: path.steep[i] === 1,
    rubberX: t.rubberX,
    cutter: [graver.tip[0], graver.tip[1]],
    graver,
    swing,
    pump: path.pump[i],
    phase: rad(path.pass.phase),
    stock,
    work: straight ? headstockToMachine([0, slide], P, swing) : onHeadstock([slide, 0]),
    slideAngle: straight ? -index : at.angle - index,
    carrier: straight ? [-Math.sin(index) * slide, Math.cos(index) * slide] : [slide, 0],
    chuck,
    carriage,
  };
}

function carriagePose(stroke: number, plate: { min: Vec2; max: Vec2 }, travel: number, index: number, P: number, swing: number): CarriagePose {
  const toMachine = (h: Vec2) => headstockToMachine(h, P, swing);
  const { min, max } = plate;
  const plateCorners = ([[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]] as Vec2[]).map((w) =>
    toMachine(carriageToHeadstock(w, travel, index)),
  );
  const half = plateReach(plate);
  const corners = ([[-half, -half], [half, -half], [half, half], [-half, half]] as Vec2[]).map(([x, y]) => toMachine([x, y + travel]));
  const railX = half + 2;
  const railHalf = stroke / 2 + half + 4;
  const rails = [-railX, railX].map((x): [Vec2, Vec2] => [toMachine([x, -railHalf]), toMachine([x, railHalf])]);
  return { travel, plate, plateCorners, corners, railX, railHalf, rails };
}

/** Where the rubber's center is drawn when the swing is magnified
 *  `exaggerate` times: moved with the contact point, so the rubber stays on
 *  the swung rosette instead of the rosette passing through it. */
export function followingRubber(pose: MachinePose, pivotDistance: number, exaggerate: number): Vec2 {
  const local = machineToHeadstock(pose.contact, pivotDistance, pose.swing);
  const [x, y] = headstockToMachine(local, pivotDistance, pose.swing * exaggerate);
  return [pose.rubberX + x - pose.contact[0], y - pose.contact[1]];
}
