import type { Settings } from './toolpath/settings';

const base: Settings = {
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1 } },
  rubber: { shape: 'round', radius: 1 },
  engine: { kind: 'rose' },
  pivotDistance: 150,
  pump: null,
  chuck: null,
  surface: { kind: 'flat' },
  cutter: { vAngle: 110, tipFlat: 0 },
  job: { from: 4, to: 18, step: 0.35, depth: 0.15, phaseStep: 2, phaseGroup: 1, pumpPhaseStep: 0, indexCount: 1, wheelCount: 1, eccentricityStep: 0 },
  samplesPerTurn: 2048,
};

/** The straight-line engine's base: rows across a 30 mm stroke. */
const line: Settings = {
  ...base,
  engine: { kind: 'straight', stroke: 30 },
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0.6 } },
  job: { ...base.job, from: -12, to: 12, step: 0.3, depth: 0.12, phaseStep: 0 },
};

/** Classic patterns, each one plain settings. Half a lobe of phase is
 *  180 / lobes degrees: 15° on a 12-lobe rosette. Each cuts deep enough that
 *  its grooves overlap, leaving no uncut land between them. */
export const PRESETS = {
  /** A small phase step every pass twists the lobes into a spiral. */
  swirl: base,
  /** Groups of passes in phase, each group half a lobe from the last. */
  basket: { ...base, job: { ...base.job, step: 0.3, depth: 0.12, phaseStep: 15, phaseGroup: 4 } },
  /** Every pass half a lobe from the last: the lobes interleave into grains. */
  barleycorn: {
    ...base,
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 0.6 } },
    job: { ...base.job, step: 0.25, depth: 0.1, phaseStep: 7.5, phaseGroup: 1 },
  },
  /** A small rose cut off center, repeated at six turns of the eccentric
   *  chuck's wheel, so the roses ring the work. */
  wheel: {
    ...base,
    chuck: { kind: 'eccentric', eccentricity: 9, wheel: 0 },
    job: { ...base.job, from: 2, to: 6, step: 0.3, phaseStep: 3, wheelCount: 6 },
  },
  /** The swirl cut on an elliptical chuck: every ring an ellipse. */
  oval: {
    ...base,
    chuck: { kind: 'elliptical', eccentricity: 4, ring: 0, wheel: 0 },
    job: { ...base.job, from: 6, to: 18 },
  },
  /** Waves round a barrel from the pumping rosette, a pass every
   *  0.35 mm along it. A rosette with shallow lobes rocks the barrel
   *  into and out of the cutter, so the grooves swell and thin. */
  barrel: {
    ...base,
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0.05 } },
    pump: { rosette: { radius: 30, wave: { kind: 'sine', lobes: 9, amplitude: 1 } }, rubber: { shape: 'round', radius: 0 }, gain: 0.6 },
    surface: { kind: 'cylinder', radius: 10, length: 24 },
    job: { ...base.job, from: 1.5, to: 22.5, step: 0.35, phaseStep: 0, pumpPhaseStep: 0 },
  },
  /** A swirl cut on a dome, the graver kept square to it. Rocking carries
   *  the dome sideways under the graver, which off the pole moves it into
   *  and out of the cut, so the lobes are shallower than the face swirl's
   *  and the cut deeper, or the graver would leave the stock. */
  dome: {
    ...base,
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0.3 } },
    surface: { kind: 'dome', radius: 30, rim: 20 },
    job: { ...base.job, from: 4, to: 19, depth: 0.25 },
  },
  /** Plain parallel rows from a round rosette, which never rocks the frame. */
  ruled: {
    ...line,
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } },
  },
  /** Every row the same wave, in phase, so they nest into ripples. */
  waves: line,
  /** Each row's waves a little ahead of the last's, so the crests run on a slant. */
  flame: {
    ...line,
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 8, amplitude: 0.8 } },
    job: { ...line.job, phaseStep: 3 },
  },
  /** Barleycorn in rows: each row's waves half a lobe from the last's, so
   *  they interleave into grains. */
  grain: { ...line, job: { ...line.job, phaseStep: 15 } },
  /** Rows in groups of four in phase, each group half a lobe from the last,
   *  so the waves braid into chains. */
  chain: { ...line, job: { ...line.job, phaseStep: 15, phaseGroup: 4 } },
  /** A sharp-lobed rosette, each row half a lobe on: the lobes overlap into
   *  fish scales. */
  scales: {
    ...line,
    rosette: { radius: 30, wave: { kind: 'petal', lobes: 10, amplitude: 0.8, sharpness: 2.5 } },
    job: { ...line.job, phaseStep: 18 },
  },
  /** The ripples cut again a quarter turn round on the division plate, so the
   *  rows cross into a lattice. */
  lattice: {
    ...line,
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 10, amplitude: 0.5 } },
    job: { ...line.job, step: 0.4, depth: 0.15, indexCount: 4 },
    samplesPerTurn: 1024,
  },
} satisfies Record<string, Settings>;

export type PresetName = keyof typeof PRESETS;
