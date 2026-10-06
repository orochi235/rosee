import { expect, it } from 'vitest';
import { grooveWidth } from './cutter/cutter';
import { PRESETS } from './presets';
import { computeToolpaths } from './toolpath/toolpath';

it('cuts every preset deep enough that its grooves overlap', () => {
  for (const s of Object.values(PRESETS)) expect(grooveWidth(s.cutter, s.job.depth)).toBeGreaterThan(s.job.step);
});

it('computes every preset within the budget', () => {
  for (const s of Object.values(PRESETS)) expect(() => computeToolpaths(s)).not.toThrow();
});

it('includes a preset for each chuck', () => {
  expect(PRESETS.wheel.chuck?.kind).toBe('eccentric');
  expect(PRESETS.oval.chuck?.kind).toBe('elliptical');
});
