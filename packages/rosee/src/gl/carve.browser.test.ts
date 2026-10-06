import { describe, expect, it } from 'vitest';
import { grooveWidth } from '../cutter/cutter';
import { PRESETS } from '../presets';
import { computeToolpaths } from '../toolpath/toolpath';
import { createCarve } from './carve';
import { context } from './fixtures/context';
import { straightGroove } from './fixtures/straightGroove';
import { carveMesh } from './mesh';

/** Heights down the column through domain point u, from −v to +v. */
function column(h: Float32Array, resolution: number, extent: number, u: number): Float32Array {
  const x = Math.floor(((u / extent + 1) / 2) * resolution);
  const out = new Float32Array(resolution);
  for (let y = 0; y < resolution; y++) out[y] = h[y * resolution + x];
  return out;
}

describe('createCarve', () => {
  const cutter = { vAngle: 90, tipFlat: 0 };

  it('cuts a straight groove as wide as the cutter at that depth, to within a texel', () => {
    const gl = context();
    const carve = createCarve(gl, 1024);
    carve.load(carveMesh(straightGroove(0.2), cutter));
    carve.carve();
    const h = carve.heights();
    const texel = (2 * carve.extent) / carve.resolution;
    const col = column(h, carve.resolution, carve.extent, 0);
    const cut = col.filter((v) => v < -1e-4).length * texel;
    expect(Math.abs(cut - grooveWidth(cutter, 0.2))).toBeLessThan(1.5 * texel);
    // texel centers can straddle the tip line, missing it by up to half a texel of V
    expect(Math.abs(Math.min(...col) + 0.2)).toBeLessThan(texel);
    expect(gl.getError()).toBe(gl.NO_ERROR);
    carve.dispose();
  });

  it('keeps the deeper cut where two grooves cross', () => {
    const gl = context();
    const carve = createCarve(gl, 512);
    const a = straightGroove(0.1);
    const b = straightGroove(0.2);
    b.passes[0].across.fill(0);
    for (let i = 0; i < b.passes[0].xyz.length; i += 3) {
      const x = b.passes[0].xyz[i];
      b.passes[0].xyz[i] = 0;
      b.passes[0].xyz[i + 1] = x;
    }
    carve.load(carveMesh({ ...a, passes: [a.passes[0], b.passes[0]] }, cutter));
    carve.carve();
    const h = carve.heights();
    const mid = Math.floor(carve.resolution / 2);
    const texel = (2 * carve.extent) / carve.resolution;
    expect(Math.abs(h[mid * carve.resolution + mid] + 0.2)).toBeLessThan(texel);
  });

  it('carves only as far as the progress says', () => {
    const gl = context();
    const carve = createCarve(gl, 512);
    carve.load(carveMesh(straightGroove(0.2), cutter));
    carve.carve({ pass: 0, sample: 10 });
    const h = carve.heights();
    const row = Math.floor(carve.resolution / 2);
    const at = (u: number) => h[row * carve.resolution + Math.floor(((u / carve.extent + 1) / 2) * carve.resolution)];
    expect(at(-2)).toBeLessThan(-0.15);
    expect(at(2)).toBeCloseTo(0, 9);
  });

  it('carves nothing of a pass at a negative sample, without a GL error', () => {
    const gl = context();
    const carve = createCarve(gl, 256);
    carve.load(carveMesh(straightGroove(0.2), cutter));
    carve.carve({ pass: 0, sample: -3 });
    expect(gl.getError()).toBe(gl.NO_ERROR);
    expect(Math.min(...carve.heights())).toBeCloseTo(0, 9);
  });

  it('carves a preset to its pass depth', () => {
    const gl = context();
    const carve = createCarve(gl, 1024);
    const t = computeToolpaths({ ...PRESETS.swirl, samplesPerTurn: 1024 });
    carve.load(carveMesh(t, PRESETS.swirl.cutter));
    carve.carve();
    const h = carve.heights();
    let min = 0;
    let cut = 0;
    for (const v of h) {
      min = Math.min(min, v);
      if (v < -1e-4) cut++;
    }
    expect(min).toBeCloseTo(-PRESETS.swirl.job.depth, 2);
    expect(cut / h.length).toBeGreaterThan(0.05);
  });
});
