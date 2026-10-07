import { computeToolpaths, PRESETS, type Vec2 } from 'rosee';
import { describe, expect, it } from 'vitest';
import { type Frame, toCanvas } from './drawTop';
import { pickTop } from './pickTop';
import { at as playheadAt } from '../playhead';
import { machinePose } from './pose';

describe('pickTop', () => {
  const s = { ...PRESETS.swirl, samplesPerTurn: 256 };
  const t = computeToolpaths(s);
  const pose = machinePose(s, t, playheadAt(0, t.samples, t.passes.length));
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

  it('finds the chuck slide and the elliptical ring', () => {
    for (const preset of [PRESETS.wheel, PRESETS.oval]) {
      const cs = { ...preset, samplesPerTurn: 256 };
      const ct = computeToolpaths(cs);
      const cp = machinePose(cs, ct, playheadAt(40, ct.samples, ct.passes.length));
      const [a, b] = cp.chuck!.ends;
      const onSlide: Vec2 = [cp.spindle[0] + 0.4 * (b[0] - cp.spindle[0]), cp.spindle[1] + 0.4 * (b[1] - cp.spindle[1])];
      const cframe: Frame = { center: cp.spindle, scale: 4 };
      const cat = toCanvas(cframe, size);
      expect(pickTop(cp, cs.rubber, cframe, size, cat(onSlide))).toBe('chuck');
      expect(a).not.toEqual(b);
      if (cp.chuck!.ring) {
        const r = cp.chuck!.ring;
        expect(pickTop(cp, cs.rubber, cframe, size, cat([r[0], r[1] + cp.chuck!.ringRadius]))).toBe('ring');
        expect(pickTop(cp, cs.rubber, cframe, size, cat([cp.work[0], cp.work[1] + cp.stock - 1]))).toBe('work');
      }
    }
  });
});
