import { expect, it } from 'vitest';
import { grooveWidth } from './cutter/cutter';
import { PRESETS } from './presets';

it('cuts every preset deep enough that its grooves overlap', () => {
  for (const s of Object.values(PRESETS)) expect(grooveWidth(s.cutter, s.job.depth)).toBeGreaterThan(s.job.step);
});
