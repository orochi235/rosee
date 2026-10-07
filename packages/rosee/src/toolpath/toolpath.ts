import { rad, TAU } from '../angle';
import { contactTable, reachAt } from '../contact/table';
import { expandJob, type Pass, passCount } from '../job/job';
import { slideAt, wheelOf } from '../machine/chuck';
import { carriageAt } from '../machine/engine';
import { chuckToWork, headstockToCarriage, headstockToChuck, machineToHeadstock } from '../machine/pose';
import { swingAt, swingTable } from '../machine/swing';
import { checkSurface, graverAt, type Surface, toSheet } from '../surface/surface';
import type { Settings } from './settings';

/** One pass, sampled `samples + 1` times over a full turn (the last sample
 *  repeats the first). Sample i is at spindle angle i / samples · 2π. */
export interface PassPath {
  pass: Pass;
  /** Cutter tip in work coordinates, mm: x, y, z per sample. The face is at
   *  z = 0, the stock behind it at negative z. */
  xyz: Float32Array;
  /** The tip on the surface's sheet, mm: u, v and h per sample, h negative
   *  into the stock. On a barrel u wraps at ±πR. */
  uvh: Float32Array;
  /** Headstock swing, radians. */
  swing: Float32Array;
  /** Headstock travel toward the cutter from pumping, mm. */
  pump: Float32Array;
  /** Rosette-local angle of the outline point the rubber touches, radians
   *  in [0, 2π). */
  contact: Float32Array;
  /** 1 where the rosette's wall is steeper than the headstock's arc, so
   *  several swings touch and a real machine jumps. */
  steep: Uint8Array;
  /** Angle on the sheet, radians, of the line the graver's V opens across.
   *  The graver is fixed to the machine, so on a face this is the machine's
   *  x axis turned with the work, the swing and the chuck's wheel, not with
   *  the path; on a barrel it is always along the barrel. */
  across: Float32Array;
  /** The work's offset along its slide, mm: the chuck's, or a straight-line
   *  engine's carriage; 0 with neither. */
  slide: Float32Array;
}

export interface Toolpaths {
  samples: number;
  surface: Surface;
  /** Where the rubber sits on the machine's x axis, mm. */
  rubberX: number;
  /** Where the pumping rubber sits on its own rosette's axis, mm, or null
   *  with no pump. */
  pumpX: number | null;
  passes: PassPath[];
}

/** The samples per turn a job may ask for. */
export const SAMPLES_PER_TURN = { min: 16, max: 16384 };

/** The most samples, over every pass, one job may hold. Each costs a few
 *  hundred bytes once meshed for the carve. */
export const SAMPLE_BUDGET = 1_000_000;

/** How far along the V's opening, mm, its direction on the sheet is measured. */
const OPENS_STEP = 1e-3;

export function computeToolpaths(s: Settings): Toolpaths {
  const n = s.samplesPerTurn;
  const { min, max } = SAMPLES_PER_TURN;
  if (!(Number.isInteger(n) && n >= min && n <= max))
    throw new Error(`samplesPerTurn must be a whole number from ${min} to ${max}, got ${n}`);
  const total = passCount(s.job) * (n + 1);
  if (total > SAMPLE_BUDGET)
    throw new Error(
      `the job needs ${total.toLocaleString('en-US')} samples, over the budget of ${SAMPLE_BUDGET.toLocaleString('en-US')}: cut fewer passes or fewer samples per turn`,
    );
  if (!s.chuck && (s.job.wheelCount !== 1 || s.job.eccentricityStep !== 0))
    throw new Error('wheel divisions and an eccentricity step need a chuck: fit one, or set them back to 1 and 0');
  checkSurface(s.surface);
  const straight = s.engine.kind === 'straight' ? s.engine : null;
  if (straight) {
    if (!(straight.stroke > 0)) throw new Error(`the carriage's stroke must be positive, got ${straight.stroke}`);
    if (s.surface.kind !== 'flat') throw new Error('a straight-line engine cuts a flat face: set the surface to flat');
    if (s.chuck) throw new Error('a straight-line engine holds the work on its carriage, with no chuck: remove the chuck');
  }
  const table = contactTable(s.rosette, s.rubber);
  const pump = s.pump && { gain: s.pump.gain, table: contactTable(s.pump.rosette, s.pump.rubber) };
  const rubberX = table.mean;
  const swings = swingTable(table, rubberX, s.pivotDistance);
  const passes = expandJob(s.job).map((pass): PassPath => {
    const xyz = new Float32Array((n + 1) * 3);
    const uvh = new Float32Array((n + 1) * 3);
    const swing = new Float32Array(n + 1);
    const pumpTravel = new Float32Array(n + 1);
    const contact = new Float32Array(n + 1);
    const steep = new Uint8Array(n + 1);
    const across = new Float32Array(n + 1);
    const slide = new Float32Array(n + 1);
    const index = rad(pass.index);
    const wheel = wheelOf(s.chuck, pass);
    const graver = graverAt(s.surface, pass.at, pass.depth);
    for (let i = 0; i <= n; i++) {
      const spindle = (i / n) * TAU;
      const rosetteAngle = spindle + rad(pass.phase);
      const at = swingAt(swings, rosetteAngle);
      const sw = at.swing;
      const tip = machineToHeadstock([graver.tip[0], graver.tip[1]], s.pivotDistance, sw);
      let x: number;
      let y: number;
      let sl: number;
      if (straight) {
        sl = carriageAt(straight.stroke, spindle);
        [x, y] = headstockToCarriage(tip, sl, index);
      } else {
        sl = s.chuck ? slideAt(s.chuck, pass, spindle - index) : 0;
        [x, y] = chuckToWork(headstockToChuck(tip, spindle, index), sl, wheel);
      }
      let travel = 0;
      if (pump) {
        const [px, py] = machineToHeadstock([pump.table.mean, 0], s.pivotDistance, sw);
        const facing = Math.atan2(py, px);
        travel = pump.gain * (reachAt(pump.table, facing - spindle - rad(pass.pumpPhase)) - pump.table.mean);
      }
      const z = graver.tip[2] - travel;
      xyz[i * 3] = x;
      xyz[i * 3 + 1] = y;
      xyz[i * 3 + 2] = z;
      // The V's opening carried into the work, then onto the sheet a step along it.
      // The work turns with the spindle on a rose engine; a carriage only slides.
      const turn = index - (straight ? 0 : spindle) - sw - wheel;
      const [ox, oy, oz] = graver.opens;
      const sheet = toSheet(s.surface, x, y, z);
      const ahead = toSheet(
        s.surface,
        x + OPENS_STEP * (ox * Math.cos(turn) - oy * Math.sin(turn)),
        y + OPENS_STEP * (ox * Math.sin(turn) + oy * Math.cos(turn)),
        z + OPENS_STEP * oz,
      );
      uvh.set(sheet, i * 3);
      swing[i] = sw;
      pumpTravel[i] = travel;
      // Float32 rounds angles just under 2π up to fround(2π), which is past it.
      const c = Math.fround(at.contact);
      contact[i] = c < TAU ? c : 0;
      steep[i] = at.steep ? 1 : 0;
      across[i] = s.surface.kind === 'flat' ? turn : Math.atan2(ahead[1] - sheet[1], ahead[0] - sheet[0]);
      slide[i] = sl;
    }
    return { pass, xyz, uvh, swing, pump: pumpTravel, contact, steep, across, slide };
  });
  return { samples: n, surface: s.surface, rubberX, pumpX: pump ? pump.table.mean : null, passes };
}
