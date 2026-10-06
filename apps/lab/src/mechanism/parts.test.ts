import { computeToolpaths, PRESETS } from 'rosee';
import { expect, it } from 'vitest';
import { liveLine, type PartKey, PARTS } from './parts';
import { machinePose } from './pose';

it('gives every part its text, and a live line for every moving part', () => {
  const s = { ...PRESETS.swirl, samplesPerTurn: 256 };
  const toolpaths = computeToolpaths(s);
  const at = { pass: 4, sample: 77 };
  const c = { settings: s, toolpaths, at, pose: machinePose(s, toolpaths, at), exaggerate: 10 };
  for (const key of Object.keys(PARTS) as PartKey[]) {
    expect(PARTS[key].title && PARTS[key].what && PARTS[key].how).toBeTruthy();
    if (key !== 'bed') expect(liveLine(key, c)).toMatch(/\d/);
  }
  expect(liveLine('rosette', c)).toBe('12-lobe sine · phase 8.0°');
});
