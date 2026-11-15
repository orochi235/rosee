import { TAU } from '../angle.js';
import type { Settings } from '../toolpath/settings.js';
import type { Toolpaths } from '../toolpath/toolpath.js';
import { type Env, evaluate } from './evaluate.js';
import { equation, type Stage } from './stage.js';

/** The variables every formula in `stages` reads, at one sample of one
 *  pass: the spindle θ, swing φ, the touched rosette angle α, the depth of
 *  cut, the tip (x, y, z) in the work, and the directions β the formulas
 *  themselves give. */
export function sampleEnv(stages: readonly Stage[], s: Settings, toolpaths: Toolpaths, pass: number, sample: number): Env {
  const path = toolpaths.passes[pass];
  const base = {
    θ: (sample / toolpaths.samples) * TAU,
    φ: path.swing[sample],
    α: path.contact[sample],
    depth: -path.uvh[sample * 3 + 2],
    x: path.xyz[sample * 3],
    y: path.xyz[sample * 3 + 1],
    z: path.xyz[sample * 3 + 2],
  };
  const env: Record<string, number> = { ...base, β: evaluate(equation(stages, 'direction').rhs, base) as number };
  if (s.pump && toolpaths.pumpX !== null) {
    env.β_pump = evaluate(equation(stages, 'pump.direction').rhs, base) as number;
    // The pump's travel over its gain is how far its rubber stood from the mean.
    env.R_pump = toolpaths.pumpX + (s.pump.gain === 0 ? 0 : path.pump[sample] / s.pump.gain);
  }
  return env;
}
