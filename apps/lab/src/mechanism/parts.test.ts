import { computeToolpaths, PRESETS } from 'rosee';
import { expect, it } from 'vitest';
import { liveLine, type PartKey, PARTS } from './parts';
import { at as playheadAt } from '../playhead';
import { machinePose } from './pose';

it('gives every part its text, and a live line for every moving part', () => {
  const s = { ...PRESETS.swirl, samplesPerTurn: 256 };
  const toolpaths = computeToolpaths(s);
  const at = playheadAt(4 * 256 + 77, 256, toolpaths.passes.length);
  const c = { settings: s, toolpaths, at, pose: machinePose(s, toolpaths, at), exaggerate: 10 };
  for (const key of Object.keys(PARTS) as PartKey[]) {
    expect(PARTS[key].title && PARTS[key].what && PARTS[key].how).toBeTruthy();
    if (key !== 'bed') expect(liveLine(key, c)).toMatch(/\d/);
  }
  expect(liveLine('rosette', c)).toBe('12-lobe sine · phase 8.0°');
  expect(liveLine('spindle', c)).toBe(`108.3° into pass 5/${toolpaths.passes.length}`);
});
