import { PRESETS, type Settings } from 'rosee';
import { describe, expect, it } from 'vitest';
import { cutPanel, lookPanel, type Panel, pumpPanel, rosettePanel, rubberPanel } from './panels';
import { DEFAULT_LOOK } from './state';

const withPump: Settings = {
  ...PRESETS.swirl,
  rubber: { shape: 'flat', width: 8 },
  pump: { rosette: { radius: 30, wave: { kind: 'sine', lobes: 5, amplitude: 0.03 } }, rubber: { shape: 'round', radius: 0 }, gain: 2 },
};

describe('panels', () => {
  const panels: Panel<Settings>[] = [rosettePanel, rubberPanel, pumpPanel, cutPanel];
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
});
