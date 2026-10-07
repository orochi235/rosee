import { expect, it } from 'vitest';
import { TAU } from '../angle';
import { headstockToChuck, machineToHeadstock } from '../machine/pose';
import { computeToolpaths } from './toolpath';

it('opens the V along the machine x axis, carried into the work by spindle, index and swing', () => {
  const t = computeToolpaths({
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } },
    rubber: { shape: 'round', radius: 1 },
    pivotDistance: 60,
    pump: null,
    chuck: null,
    surface: { kind: 'flat' },
    cutter: { vAngle: 90, tipFlat: 0 },
    job: { from: 20, to: 20, step: 1, depth: 0.05, phaseStep: 0, phaseGroup: 1, pumpPhaseStep: 0, indexCount: 3, wheelCount: 1, eccentricityStep: 0 },
    samplesPerTurn: 360,
  });
  for (const path of t.passes) {
    const index = (path.pass.index * Math.PI) / 180;
    for (let i = 0; i <= t.samples; i += 7) {
      const spindle = (i / t.samples) * TAU;
      const at = (x: number) => headstockToChuck(machineToHeadstock([x, 0], 60, path.swing[i]), spindle, index);
      const [x0, y0] = at(20);
      const [x1, y1] = at(21);
      const d = Math.atan2(y1 - y0, x1 - x0) - path.across[i];
      expect(Math.abs(d - TAU * Math.round(d / TAU))).toBeLessThan(1e-5);
    }
  }
});
