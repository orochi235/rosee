import { describe, expect, it } from 'vitest';
import { TAU } from '../../angle';
import type { Vec2 } from '../../machine/pose';
import { radiusAt, type Rosette } from '../rosette';
import { dxfLoops } from './dxf';
import { type Gray, traceLoops } from './image';
import { rosetteFromDxf, rosetteFromImage, rosetteFromSvg } from './index';
import { rosetteFromOutline } from './outline';
import { svgLoops } from './svg';

const SINE: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } };
const PETAL: Rosette = { radius: 25, wave: { kind: 'petal', lobes: 7, amplitude: 1, sharpness: 2 } };

const outline = (r: Rosette, n = 2048, scale = 1): Vec2[] =>
  Array.from({ length: n }, (_, k) => {
    const a = (k / n) * TAU;
    const rr = radiusAt(r, a) * scale;
    return [rr * Math.cos(a), rr * Math.sin(a)];
  });

/** The worst gap between two rosettes' outlines, over every turn of one
 *  against the other, so an import that comes back phased differently still matches. */
function worst(a: Rosette, b: Rosette): number {
  let best = Infinity;
  for (let shift = 0; shift < 720; shift++) {
    const s = (shift / 720) * TAU;
    let w = 0;
    for (let k = 0; k < 360; k++) {
      const t = (k / 360) * TAU;
      w = Math.max(w, Math.abs(radiusAt(a, t) - radiusAt(b, t + s)));
      if (w > best) break;
    }
    best = Math.min(best, w);
  }
  return best;
}

describe('rosetteFromOutline', () => {
  it('reads a sine rosette back as twelve lobes of the same shape', () => {
    const { rosette, lobes } = rosetteFromOutline(outline(SINE));
    expect(lobes).toBe(12);
    expect(rosette.radius).toBeCloseTo(30, 2);
    expect(worst(SINE, rosette)).toBeLessThan(0.02);
  });

  it('finds an odd lobe count', () => {
    const { rosette, lobes } = rosetteFromOutline(outline(PETAL));
    expect(lobes).toBe(7);
    expect(worst(PETAL, rosette)).toBeLessThan(0.05);
  });

  it('puts the lobe peak at the start of the lobe', () => {
    const { rosette } = rosetteFromOutline(outline(SINE).map(([x, y]): Vec2 => [x * Math.cos(0.3) - y * Math.sin(0.3), x * Math.sin(0.3) + y * Math.cos(0.3)]));
    if (rosette.wave.kind !== 'drawn') throw new Error('expected a drawn wave');
    const ps = rosette.wave.points.map((q) => q.p);
    expect(ps[0]).toBe(Math.max(...ps));
  });

  it('reads a circle as one lobe of no amplitude', () => {
    const { rosette, lobes } = rosetteFromOutline(outline({ radius: 20, wave: { kind: 'sine', lobes: 1, amplitude: 0 } }));
    expect(lobes).toBe(1);
    expect(rosette.radius).toBeCloseTo(20, 3);
    expect(rosette.wave.kind === 'drawn' && rosette.wave.amplitude).toBeLessThan(0.01);
  });

  it('scales the outline to a mean radius given', () => {
    const { rosette } = rosetteFromOutline(outline(SINE, 2048, 5), { radius: 30 });
    expect(worst(SINE, rosette)).toBeLessThan(0.02);
  });

  it('refuses an outline that does not surround its own center', () => {
    const arc: Vec2[] = [];
    for (let k = 0; k <= 64; k++) arc.push([30 * Math.cos((k / 64) * Math.PI), 30 * Math.sin((k / 64) * Math.PI)]);
    for (let k = 64; k >= 0; k--) arc.push([28 * Math.cos((k / 64) * Math.PI), 28 * Math.sin((k / 64) * Math.PI)]);
    expect(() => rosetteFromOutline(arc)).toThrow(/all the way round/);
  });
});

const svgPath = (pts: Vec2[]) => `M ${pts.map(([x, y]) => `${x.toFixed(4)} ${y.toFixed(4)}`).join(' L ')} Z`;

describe('SVG', () => {
  it('reads a rosette drawn in mm, ignoring the arbor hole', () => {
    const svg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="80mm" height="80mm" viewBox="-40 -40 80 80">
  <!-- a rosette -->
  <path d="${svgPath(outline(SINE))}" fill="black"/>
  <circle cx="0" cy="0" r="4" fill="white"/>
</svg>`;
    const { rosette, lobes } = rosetteFromSvg(svg);
    expect(lobes).toBe(12);
    expect(worst(SINE, rosette)).toBeLessThan(0.02);
  });

  it('reads px at 96 per inch, through a group transform', () => {
    const px = 96 / 25.4;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(200 200) scale(2)">
      <polygon points="${outline(SINE, 2048, px / 2).flat().join(',')}"/></g></svg>`;
    expect(worst(SINE, rosetteFromSvg(svg).rosette)).toBeLessThan(0.02);
  });

  it('flattens arcs and curves', () => {
    const arcs = svgLoops('<svg width="100mm" viewBox="0 0 100 100"><path d="M 80 50 A 30 30 0 1 1 20 50 A 30 30 0 1 1 80 50 Z"/></svg>');
    const k = 0.5522847 * 30;
    const curves = svgLoops(
      `<svg width="100mm" viewBox="0 0 100 100"><path d="M80,50C80,${50 + k} ${50 + k},80 50,80S20,${50 + k} 20,50s${30 - k},-30 30,-30 30,${30 - k} 30,30z"/></svg>`,
    );
    for (const loops of [arcs, curves]) {
      const { rosette } = rosetteFromOutline(loops[0]);
      expect(rosette.radius).toBeCloseTo(30, 1);
    }
  });
});

const dxf = (body: string[], units = 4) =>
  ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', String(units), '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', ...body, '0', 'ENDSEC', '0', 'EOF'].join('\n');

describe('DXF', () => {
  it('reads a closed polyline rosette', () => {
    const pts = outline(SINE, 1024);
    const body = ['0', 'LWPOLYLINE', '90', String(pts.length), '70', '1', ...pts.flatMap(([x, y]) => ['10', String(x), '20', String(y)])];
    const { rosette, lobes } = rosetteFromDxf(dxf(body));
    expect(lobes).toBe(12);
    expect(worst(SINE, rosette)).toBeLessThan(0.03);
  });

  it('reads a circle in inches as millimeters', () => {
    const { rosette } = rosetteFromDxf(dxf(['0', 'CIRCLE', '10', '0', '20', '0', '40', '1'], 1));
    expect(rosette.radius).toBeCloseTo(25.4, 2);
  });

  it('follows a polyline round its bulges', () => {
    const body = ['0', 'LWPOLYLINE', '90', '2', '70', '1', '10', '10', '20', '0', '42', '1', '10', '-10', '20', '0', '42', '1'];
    expect(rosetteFromDxf(dxf(body)).rosette.radius).toBeCloseTo(10, 2);
  });

  it('chains lines and arcs into a loop', () => {
    // A half disc: an arc over the top, a line across the bottom.
    const body = ['0', 'ARC', '10', '0', '20', '0', '40', '10', '50', '0', '51', '180', '0', 'LINE', '10', '-10', '20', '0', '11', '10', '21', '0'];
    const loops = dxfLoops(dxf(body));
    expect(loops).toHaveLength(1);
    let area = 0;
    for (let k = 0; k < loops[0].length; k++) {
      const [a, b] = [loops[0][k], loops[0][(k + 1) % loops[0].length]];
      area += a[0] * b[1] - b[0] * a[1];
    }
    expect(Math.abs(area / 2)).toBeCloseTo((Math.PI * 100) / 2, 0);
  });
});

/** A picture of a rosette, light on dark, with a dark arbor hole, `scale`
 *  pixels to the mm. */
function picture(r: Rosette, scale: number, size: number): Gray {
  const data = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [dx, dy] = [(x + 0.5 - size / 2) / scale, (size / 2 - y - 0.5) / scale];
      const d = Math.hypot(dx, dy);
      // Lit by how much of the pixel the rosette covers, so its edge is soft like a photo's.
      const inside = Math.max(0, Math.min(1, (radiusAt(r, Math.atan2(dy, dx)) - d) * scale + 0.5));
      const hole = d < 3 ? 1 : 0;
      data[y * size + x] = 20 + 200 * inside * (1 - hole);
    }
  }
  return { width: size, height: size, data };
}

describe('tracing a picture', () => {
  it('traces a rosette to within a fraction of a pixel', () => {
    const scale = 5;
    const { rosette, lobes } = rosetteFromImage(picture(SINE, scale, 360), { radius: 30 });
    expect(lobes).toBe(12);
    expect(worst(SINE, rosette)).toBeLessThan(0.2 / scale);
  });

  it('closes a shape that runs off the picture', () => {
    const g: Gray = { width: 4, height: 4, data: new Float32Array(16).fill(200) };
    expect(traceLoops(g, 100)).toHaveLength(0);
    const half: Gray = { width: 4, height: 4, data: Float32Array.from({ length: 16 }, (_, k) => (k % 4 < 2 ? 200 : 10)) };
    expect(traceLoops(half, 100)).toHaveLength(1);
  });
});
