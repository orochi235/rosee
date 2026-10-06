import { computeToolpaths, PRESETS } from 'rosee';
import { describe, expect, it } from 'vitest';
import { at } from '../playhead';
import { machinePose } from './pose';

describe('machinePose', () => {
  const s = { ...PRESETS.swirl, samplesPerTurn: 256 };
  const t = computeToolpaths(s);

  it('puts the contact one rubber radius from the rubber center', () => {
    for (const sample of [0, 17, 90, 200]) {
      const pose = machinePose(s, t, at(3 * 256 + sample, 256, t.passes.length));
      expect(Math.hypot(pose.contact[0] - pose.rubberX, pose.contact[1])).toBeCloseTo(1, 2);
    }
  });

  it('closes the rosette outline', () => {
    const { rosette } = machinePose(s, t, at(0, 256, t.passes.length));
    expect(rosette[0][0]).toBeCloseTo(rosette[rosette.length - 1][0], 9);
    expect(rosette[0][1]).toBeCloseTo(rosette[rosette.length - 1][1], 9);
  });
});
