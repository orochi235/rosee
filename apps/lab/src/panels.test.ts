import { computeToolpaths, PRESETS, type Settings } from 'rosee';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CHUCKS } from './defaults';
import { chuckPanel, cutPanel, lookPanel, type Panel, pumpPanel, rosettePanel, rubberPanel, surfacePanel } from './panels';
import { DEFAULT_LOOK } from './state';

const withPump: Settings = {
  ...PRESETS.swirl,
  rubber: { shape: 'flat', width: 8 },
  pump: { rosette: { radius: 30, wave: { kind: 'sine', lobes: 5, amplitude: 0.03 } }, rubber: { shape: 'round', radius: 0 }, gain: 2 },
};

describe('panels', () => {
  const panels: Panel<Settings>[] = [rosettePanel, rubberPanel, pumpPanel, chuckPanel, surfacePanel, cutPanel];
  for (const panel of panels) {
    it(`${panel.title}: writing back what it read changes nothing`, () => {
      for (const s of [...Object.values(PRESETS), withPump]) expect(panel.write(s, panel.read(s))).toEqual(s);
    });
  }

  it('Look: writing back what it read changes nothing', () => {
    expect(lookPanel.write(DEFAULT_LOOK, lookPanel.read(DEFAULT_LOOK))).toEqual(DEFAULT_LOOK);
  });

  it('switching the rosette to drawn starts from a profile', () => {
    const s = rosettePanel.write(PRESETS.swirl, { ...rosettePanel.read(PRESETS.swirl), kind: 'drawn' });
    expect(s.rosette.wave.kind === 'drawn' && s.rosette.wave.points.length).toBeGreaterThan(1);
  });

  it('turning the pump off clears it', () => {
    expect(pumpPanel.write(withPump, { ...pumpPanel.read(withPump), on: false }).pump).toBeNull();
  });

  it('removing the chuck resets its job fields, so the job still cuts', () => {
    const off = chuckPanel.write(PRESETS.wheel, { ...chuckPanel.read(PRESETS.wheel), kind: 'none' });
    expect(off.chuck).toBeNull();
    expect(off.job.wheelCount).toBe(1);
    expect(off.job.eccentricityStep).toBe(0);
    expect(() => computeToolpaths({ ...off, samplesPerTurn: 256 })).not.toThrow();
  });

  it('switching the chuck kind keeps its eccentricity and wheel', () => {
    const read = chuckPanel.read(PRESETS.wheel);
    const s = chuckPanel.write(PRESETS.wheel, { ...read, kind: 'elliptical', eccentricity: 5.5, wheel: 30 });
    expect(s.chuck).toEqual({ ...DEFAULT_CHUCKS.elliptical, eccentricity: 5.5, wheel: 30 });
  });

  it('switching between curved surfaces keeps the radius', () => {
    const s = surfacePanel.write(PRESETS.barrel, { ...surfacePanel.read(PRESETS.barrel), kind: 'dome' });
    expect(s.surface).toEqual({ kind: 'dome', radius: 10, rim: 10 });
  });

  it('writes the job position through whichever field the surface shows', () => {
    const c = cutPanel.read(PRESETS.barrel);
    const s = cutPanel.write(PRESETS.barrel, { ...c, from_cylinder: 3, to_flat: 99 });
    expect(s.job.from).toBe(3);
    expect(s.job.to).toBe(PRESETS.barrel.job.to);
  });

  it('fitting a chuck starts from its defaults', () => {
    const on = chuckPanel.write(PRESETS.swirl, { ...chuckPanel.read(PRESETS.swirl), kind: 'elliptical' });
    expect(on.chuck).toEqual(DEFAULT_CHUCKS.elliptical);
  });
});
