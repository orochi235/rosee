import { computeToolpaths, PRESETS } from 'rosee';
import { expect, it } from 'vitest';
import { ALL_PARTS, liveLine, PARTS, partsFor } from './parts';
import { at as playheadAt } from '../playhead';
import { machinePose } from './pose';

it('gives every part its text, and a live line for every moving part', () => {
  const s = { ...PRESETS.swirl, samplesPerTurn: 256 };
  const toolpaths = computeToolpaths(s);
  const at = playheadAt(4 * 256 + 77, 256, toolpaths.passes.length);
  const c = { settings: s, toolpaths, at, pose: machinePose(s, toolpaths, at), exaggerate: 10 };
  for (const key of partsFor(s, ALL_PARTS)) {
    expect(PARTS[key].title && PARTS[key].what && PARTS[key].how).toBeTruthy();
    if (key !== 'bed') expect(liveLine(key, c)).toMatch(/\d/);
  }
  expect(liveLine('rosette', c)).toBe('12-lobe sine · phase 8.0°');
  expect(liveLine('spindle', c)).toBe(`108.3° into pass 5/${toolpaths.passes.length}`);
});

it('lists and explains the chuck parts when a chuck is fitted', () => {
  const s = { ...PRESETS.oval, samplesPerTurn: 256 };
  const toolpaths = computeToolpaths(s);
  const at = playheadAt(77, 256, toolpaths.passes.length);
  const c = { settings: s, toolpaths, at, pose: machinePose(s, toolpaths, at), exaggerate: 10 };
  expect(partsFor(PRESETS.swirl, ALL_PARTS)).not.toContain('chuck');
  expect(partsFor(PRESETS.wheel, ALL_PARTS)).toContain('chuck');
  expect(partsFor(PRESETS.wheel, ALL_PARTS)).not.toContain('ring');
  expect(partsFor(s, ALL_PARTS)).toEqual(ALL_PARTS);
  for (const key of ['chuck', 'ring'] as const) expect(PARTS[key].title && PARTS[key].what && PARTS[key].how).toBeTruthy();
  expect(liveLine('chuck', c)).toMatch(/^elliptical · slide -?\d+\.\d\d of ±4\.00 mm · wheel 0\.0°$/);
  expect(liveLine('ring', c)).toBe('4.00 mm off the spindle toward 0.0°');
});
