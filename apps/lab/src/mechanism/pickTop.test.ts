import { computeToolpaths, PRESETS, type Vec2 } from 'rosee';
import { describe, expect, it } from 'vitest';
import { type Frame, toCanvas } from './drawTop';
import { pickTop } from './pickTop';
import { machinePose } from './pose';

describe('pickTop', () => {
  const s = { ...PRESETS.swirl, samplesPerTurn: 256 };
  const pose = machinePose(s, computeToolpaths(s), { pass: 0, sample: 0 });
  const size = { width: 400, height: 300 };
  const frame: Frame = { center: [5, 0], scale: 4 };
  const at = toCanvas(frame, size);
  const pick = (p: Vec2) => pickTop(pose, s.rubber, frame, size, at(p));

  it('finds each part at its own place', () => {
    expect(pick([pose.rubberX, 0])).toBe('rubber');
    expect(pick([pose.cutter[0] + 1, 0])).toBe('cutter');
    expect(pick(pose.spindle)).toBe('spindle');
    expect(pick(pose.rosette[90])).toBe('rosette');
    expect(pick([pose.spindle[0] + 2, pose.spindle[1] + 6])).toBe('work');
    expect(pick([pose.spindle[0], pose.spindle[1] - 25])).toBe('headstock');
  });

  it('finds nothing in empty space', () => {
    expect(pick([pose.spindle[0] - 34, 30])).toBeNull();
  });
});
