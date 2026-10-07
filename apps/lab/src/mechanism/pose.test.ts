import { computeToolpaths, PRESETS } from 'rosee';
import { describe, expect, it } from 'vitest';
import { at } from '../playhead';
import { followingRubber, machinePose, workToMachine } from './pose';
import { cutPath, cutTo } from './trail';

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

  it('puts the work center at the slide offset, turned with the spindle', () => {
    const w = { ...PRESETS.wheel, samplesPerTurn: 256 };
    const wt = computeToolpaths(w);
    const pose = machinePose(w, wt, at(64, 256, wt.passes.length));
    expect(Math.hypot(pose.work[0] - pose.spindle[0], pose.work[1] - pose.spindle[1])).toBeCloseTo(9, 3);
    expect(pose.chuck?.slide).toBe(9);
    expect(pose.stock).toBeGreaterThanOrEqual(6 + 9);
  });

  it('places the elliptical ring e off the spindle', () => {
    const o = { ...PRESETS.oval, samplesPerTurn: 256 };
    const ot = computeToolpaths(o);
    const pose = machinePose(o, ot, at(10, 256, ot.passes.length));
    const [rx, ry] = pose.chuck!.ring!;
    expect(Math.hypot(rx - pose.spindle[0], ry - pose.spindle[1])).toBeCloseTo(4, 3);
  });

  it('has no chuck and the work on the spindle without one', () => {
    const pose = machinePose(s, t, at(10, 256, t.passes.length));
    expect(pose.chuck).toBeNull();
    expect(pose.work).toEqual(pose.spindle);
  });

  it('moves the elliptical ring out with the eccentricity step', () => {
    const o = { ...PRESETS.oval, job: { ...PRESETS.oval.job, eccentricityStep: 0.5 }, samplesPerTurn: 256 };
    const ot = computeToolpaths(o);
    const pose = machinePose(o, ot, at(4 * 256 + 10, 256, ot.passes.length));
    const [rx, ry] = pose.chuck!.ring!;
    expect(Math.hypot(rx - pose.spindle[0], ry - pose.spindle[1])).toBeCloseTo(4 + 4 * 0.5, 3);
  });

  it("keeps the graver on the straight-line engine's plate, at every index, as the carriage slides", () => {
    const g = { ...PRESETS.lattice, samplesPerTurn: 64 };
    const gt = computeToolpaths(g);
    for (const pass of [0, 70, gt.passes.length - 1])
      for (const sample of [0, 20, 63]) {
        const pose = machinePose(g, gt, at(pass * 64 + sample, 64, gt.passes.length));
        const c = pose.carriage!;
        expect(c.travel).toBe(gt.passes[pass].slide[sample]);
        const [x, y] = pose.cutter;
        const xs = c.plateCorners.map((p) => p[0]);
        const ys = c.plateCorners.map((p) => p[1]);
        expect(x).toBeGreaterThan(Math.min(...xs));
        expect(x).toBeLessThan(Math.max(...xs));
        expect(y).toBeGreaterThan(Math.min(...ys));
        expect(y).toBeLessThan(Math.max(...ys));
      }
  });

  it('carries the cut so far to the graver tip on a face, chuck or carriage alike', () => {
    for (const name of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
      const p = { ...PRESETS[name], samplesPerTurn: 128 };
      if (p.surface.kind !== 'flat') continue;
      const tp = computeToolpaths(p);
      const xyz = cutPath(tp);
      for (const position of [5, 128 + 40, tp.passes.length * 128 - 3]) {
        const now = at(position, 128, tp.passes.length);
        const pose = machinePose(p, tp, now);
        const k = cutTo(now, tp.samples);
        const [x, y] = workToMachine(pose)([xyz[k * 3], xyz[k * 3 + 1]]);
        expect(Math.hypot(x - pose.cutter[0], y - pose.cutter[1]), `${name} at ${position}`).toBeLessThan(1e-6);
      }
    }
  });
});
