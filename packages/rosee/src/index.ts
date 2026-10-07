export { deg, rad, TAU } from './angle';
export { CONTACT_SAMPLES, type ContactTable, contactTable, reachAt, type Rubber, rubberReach } from './contact/table';
export { type Cutter, grooveWidth } from './cutter/cutter';
export { type SvgOptions, toolpathsSvg } from './export/svg';
export { expandJob, type Job, type Pass, passCount } from './job/job';
export { type Chuck, slideAt, wheelOf } from './machine/chuck';
export {
  chuckToHeadstock,
  chuckToWork,
  headstockToChuck,
  headstockToMachine,
  machineToHeadstock,
  type Vec2,
  workToChuck,
} from './machine/pose';
export { contactGap, solveSwing } from './machine/swing';
export { type DescribeOptions, describe } from './math/describe';
export { sampleEnv } from './math/env';
export { type Env, evaluate, type Value } from './math/evaluate';
export type { Expr, Name } from './math/expr';
export { type MathMLOptions, toMathML } from './math/mathml';
export { type Equation, equation, equationMathML, type Stage, type Unit } from './math/stage';
export { choice, type ChoiceParam, num, type NumberParam, type ParamSpec } from './params';
export { PRESETS, type PresetName } from './presets';
export type { ProfilePoint } from './rosette/profile';
export { displacement, radiusAt, type Rosette, WAVE_PARAMS, type Wave, type WaveKind } from './rosette/rosette';
export {
  checkSurface,
  flatFace,
  fromSheet,
  type Graver,
  graverAt,
  reachOf,
  sheetPeriod,
  type Surface,
  toSheet,
  type Vec3,
} from './surface/surface';
export type { Pump, Settings } from './toolpath/settings';
export { sheetRuns } from './toolpath/runs';
export { computeToolpaths, type PassPath, SAMPLE_BUDGET, SAMPLES_PER_TURN, type Toolpaths } from './toolpath/toolpath';
