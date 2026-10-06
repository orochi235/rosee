import { describe, expect, it } from 'vitest';
import { PRESETS } from '../presets';
import { computeToolpaths } from '../toolpath/toolpath';
import { simplify, toolpathsSvg } from './svg';

const points = (svg: string): [number, number][][] =>
  [...svg.matchAll(/<polyline points="([^"]*)"/g)].map((m) => m[1].split(' ').map((p) => p.split(',').map(Number) as [number, number]));

/** Distance from a point to the nearest segment of a polyline. */
function distance([x, y]: [number, number], line: [number, number][]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const dx = line[i][0] - ax;
    const dy = line[i][1] - ay;
    const len2 = dx * dx + dy * dy;
    const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(x - ax - s * dx, y - ay - s * dy));
  }
  return best;
}

describe('toolpathsSvg', () => {
  const t = computeToolpaths({ ...PRESETS.swirl, samplesPerTurn: 512 });

  it('draws one polyline per pass, sized in mm', () => {
    const svg = toolpathsSvg(t);
    expect(svg.match(/<polyline /g)).toHaveLength(t.passes.length);
    expect(svg).toMatch(/width="[\d.]+mm"/);
  });

  it('draws an empty, finite picture with no passes', () => {
    const svg = toolpathsSvg({ samples: 90, rubberX: 30, passes: [] });
    expect(svg).not.toMatch(/Infinity|NaN/);
    expect(svg.match(/<polyline /g)).toBeNull();
  });

  it('keeps every sample within the tolerance of the simplified line', () => {
    const tolerance = 0.002;
    const lines = points(toolpathsSvg(t, { tolerance }));
    for (const [k, p] of t.passes.entries()) {
      for (let i = 0; i < p.xyz.length; i += 3) {
        // Rounding to the micrometer adds up to half of one to each end.
        expect(distance([p.xyz[i], -p.xyz[i + 1]], lines[k])).toBeLessThan(tolerance + 0.001);
      }
    }
  });

  it('keeps every sample with no tolerance, and at the default sampling drops most with one', () => {
    expect(points(toolpathsSvg(t, { tolerance: 0 }))[0]).toHaveLength(t.samples + 1);
    const dense = computeToolpaths(PRESETS.swirl);
    const all = points(toolpathsSvg(dense, { tolerance: 0 })).flat().length;
    const fewer = points(toolpathsSvg(dense, { tolerance: 0.001 })).flat().length;
    expect(fewer).toBeLessThan(all / 2);
  });

  it('draws only the cut so far, in the whole job\'s frame', () => {
    const whole = toolpathsSvg(t);
    const part = toolpathsSvg(t, { upTo: { pass: 2, sample: 100 }, tolerance: 0 });
    const lines = points(part);
    expect(lines).toHaveLength(3);
    expect(lines[2]).toHaveLength(101);
    expect(part.match(/viewBox="[^"]*"/)?.[0]).toBe(whole.match(/viewBox="[^"]*"/)?.[0]);
  });

  it('styles the lines and fills a background on request', () => {
    const svg = toolpathsSvg(t, { stroke: '#d9d4c7', strokeWidth: 0.05, background: '#101012' });
    expect(svg).toMatch(/<rect [^>]*fill="#101012"/);
    expect(svg).toMatch(/stroke="#d9d4c7" stroke-width="0.05"/);
    expect(toolpathsSvg(t)).not.toMatch(/<rect/);
  });

  it('stores metadata, escaped', () => {
    const svg = toolpathsSvg(t, { metadata: 'https://example.com/?a=1&b=<2>' });
    expect(svg).toContain('<metadata>https://example.com/?a=1&amp;b=&lt;2&gt;</metadata>');
  });
});

describe('simplify', () => {
  it('drops points on a straight line and keeps a corner', () => {
    const xy = new Float64Array([0, 0, 1, 0, 2, 0, 2, 1, 2, 2]);
    expect(simplify(xy, 0.01)).toEqual([0, 2, 4]);
  });

  it('keeps a path that doubles back on itself', () => {
    const xy = new Float64Array([0, 0, 2, 0, 1, 0]);
    expect(simplify(xy, 0.01)).toEqual([0, 1, 2]);
  });
});
