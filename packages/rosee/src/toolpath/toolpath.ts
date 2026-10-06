import { rad, TAU } from '../angle';
import { contactTable, reachAt } from '../contact/table';
import { expandJob, type Pass, passCount } from '../job/job';
import { slideAt, wheelOf } from '../machine/chuck';
import { chuckToWork, headstockToChuck, machineToHeadstock } from '../machine/pose';
import { swingAt, swingTable } from '../machine/swing';
import type { Settings } from './settings';

/** One pass, sampled `samples + 1` times over a full turn (the last sample
 *  repeats the first). Sample i is at spindle angle i / samples · 2π. */
export interface PassPath {
  pass: Pass;
  /** Cutter tip in work coordinates, mm: x, y, z per sample. z is negative
   *  into the stock. */
  xyz: Float32Array;
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
  /** Work-frame angle, radians, of the line the graver's V opens across: the
   *  machine's x axis. The graver is fixed to the machine, so this turns with
   *  the work, the swing and the chuck's wheel, not with the path. */
  across: Float32Array;
  /** The work's offset along the chuck's slide, mm; 0 with no chuck. */
  slide: Float32Array;
}

export interface Toolpaths {
  samples: number;
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
  const table = contactTable(s.rosette, s.rubber);
  const pump = s.pump && { gain: s.pump.gain, table: contactTable(s.pump.rosette, s.pump.rubber) };
  const rubberX = table.mean;
  const swings = swingTable(table, rubberX, s.pivotDistance);
  const passes = expandJob(s.job).map((pass): PassPath => {
    const xyz = new Float32Array((n + 1) * 3);
    const swing = new Float32Array(n + 1);
    const pumpTravel = new Float32Array(n + 1);
    const contact = new Float32Array(n + 1);
    const steep = new Uint8Array(n + 1);
    const across = new Float32Array(n + 1);
    const slide = new Float32Array(n + 1);
    const index = rad(pass.index);
    const wheel = wheelOf(s.chuck, pass);
    for (let i = 0; i <= n; i++) {
      const spindle = (i / n) * TAU;
      const rosetteAngle = spindle + rad(pass.phase);
      const at = swingAt(swings, rosetteAngle);
      const sw = at.swing;
      const tip = machineToHeadstock([pass.radius, 0], s.pivotDistance, sw);
      const onChuck = headstockToChuck(tip, spindle, index);
      const sl = s.chuck ? slideAt(s.chuck, pass, spindle - index) : 0;
      const [x, y] = chuckToWork(onChuck, sl, wheel);
      let travel = 0;
      if (pump) {
        const [px, py] = machineToHeadstock([pump.table.mean, 0], s.pivotDistance, sw);
        const facing = Math.atan2(py, px);
        travel = pump.gain * (reachAt(pump.table, facing - spindle - rad(pass.pumpPhase)) - pump.table.mean);
      }
      xyz[i * 3] = x;
      xyz[i * 3 + 1] = y;
      xyz[i * 3 + 2] = -(pass.depth + travel);
      swing[i] = sw;
      pumpTravel[i] = travel;
      // Float32 rounds angles just under 2π up to fround(2π), which is past it.
      const c = Math.fround(at.contact);
      contact[i] = c < TAU ? c : 0;
      steep[i] = at.steep ? 1 : 0;
      across[i] = index - spindle - sw - wheel;
      slide[i] = sl;
    }
    return { pass, xyz, swing, pump: pumpTravel, contact, steep, across, slide };
  });
  return { samples: n, rubberX, pumpX: pump ? pump.table.mean : null, passes };
}
