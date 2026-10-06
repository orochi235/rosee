import { computeToolpaths, PRESETS } from 'rosee';
import { describe, expect, it } from 'vitest';
import { at } from '../playhead';
import { followingRubber, machinePose } from './pose';

describe('machinePose', () => {
  const s = { ...PRESETS.swirl, samplesPerTurn: 256 };
  const t = computeToolpaths(s);

  it('puts the contact one rubber radius from the rubber center', () => {
    for (const sample of [0, 17, 90, 200]) {
      const pose = machinePose(s, t, at(3 * 256 + sample, 256, t.passes.length));
      expect(Math.hypot(pose.contact[0] - pose.rubberX, pose.contact[1])).toBeCloseTo(1, 2);
    }
  });

  it('keeps the rubber one radius off the rosette when the swing is magnified', () => {
    const P = s.pivotDistance;
    for (const sample of [0, 17, 90, 200]) {
      const pose = machinePose(s, t, at(3 * 256 + sample, 256, t.passes.length));
      const [rx, ry] = followingRubber(pose, P, 10);
      // The outline swung a further 9 times its swing about the pivot.
      const extra = pose.swing * 9;
      const c = Math.cos(extra);
      const sn = Math.sin(extra);
      let nearest = Infinity;
      for (const [x, y] of pose.rosette) {
        const sx = c * x - sn * (y + P);
        const sy = sn * x + c * (y + P) - P;
        nearest = Math.min(nearest, Math.hypot(sx - rx, sy - ry));
      }
      expect(nearest).toBeCloseTo(1, 1);
    }
  });

  it('closes the rosette outline', () => {
    const { rosette } = machinePose(s, t, at(0, 256, t.passes.length));
    expect(rosette[0][0]).toBeCloseTo(rosette[rosette.length - 1][0], 9);
    expect(rosette[0][1]).toBeCloseTo(rosette[rosette.length - 1][1], 9);
  });
});
