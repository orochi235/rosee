import type { Settings } from './toolpath/settings';

const base: Settings = {
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1 } },
  rubber: { shape: 'round', radius: 1 },
  pivotDistance: 150,
  pump: null,
  cutter: { vAngle: 110, tipFlat: 0 },
  job: { from: 4, to: 18, step: 0.35, depth: 0.06, phaseStep: 2, phaseGroup: 1, pumpPhaseStep: 0, indexCount: 1 },
  samplesPerTurn: 2048,
};

/** Classic patterns, each one plain settings. Half a lobe of phase is
 *  180 / lobes degrees: 15° on a 12-lobe rosette. */
export const PRESETS = {
  /** A small phase step every pass twists the lobes into a spiral. */
  swirl: base,
  /** Groups of passes in phase, each group half a lobe from the last. */
  basket: { ...base, job: { ...base.job, step: 0.3, phaseStep: 15, phaseGroup: 4 } },
  /** Every pass half a lobe from the last: the lobes interleave into grains. */
  barleycorn: {
    ...base,
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 0.6 } },
    job: { ...base.job, step: 0.25, phaseStep: 7.5, phaseGroup: 1 },
  },
} satisfies Record<string, Settings>;

export type PresetName = keyof typeof PRESETS;
