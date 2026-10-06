import { expect, it } from 'vitest';
import { PRESETS } from '../presets';
import { computeToolpaths } from '../toolpath/toolpath';
import { toolpathsSvg } from './svg';

it('draws one polyline per pass, sized in mm', () => {
  const t = computeToolpaths({ ...PRESETS.swirl, samplesPerTurn: 90 });
  const svg = toolpathsSvg(t);
  expect(svg.match(/<polyline /g)).toHaveLength(t.passes.length);
  expect(svg).toMatch(/width="[\d.]+mm"/);
});

it('draws an empty, finite picture with no passes', () => {
  const svg = toolpathsSvg({ samples: 90, rubberX: 30, passes: [] });
  expect(svg).not.toMatch(/Infinity|NaN/);
  expect(svg.match(/<polyline /g)).toBeNull();
});
