import { describe, expect, it } from 'vitest';
import { grooveWidth } from '../cutter/cutter';
import { PRESETS } from '../presets';
import { computeToolpaths } from '../toolpath/toolpath';
import { type Carve, createCarve } from './carve';
import { context } from './fixtures/context';
import { straightGroove } from './fixtures/straightGroove';
import { carveMesh } from './mesh';

/** Heights down the column through sheet point u, from −v to +v. */
function column(h: Float32Array, carve: Carve, u: number): Float32Array {
  const [u0, u1] = carve.bounds.u;
  const x = Math.floor(((u - u0) / (u1 - u0)) * carve.width);
  const out = new Float32Array(carve.height);
  for (let y = 0; y < carve.height; y++) out[y] = h[y * carve.width + x];
  return out;
}

/** The size of a texel along u, mm. */
const texelOf = (carve: Carve) => (carve.bounds.u[1] - carve.bounds.u[0]) / carve.width;

describe('createCarve', () => {
  const cutter = { vAngle: 90, tipFlat: 0 };

  it('refuses a resolution the GPU cannot hold', () => {
    const gl = context();
    const max: number = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    expect(() => createCarve(gl, max * 2)).toThrow(/carve resolution must be a whole number from 1 to/);
    expect(() => createCarve(gl, 100.5)).toThrow(/carve resolution/);
  });

  it('cuts a straight groove as wide as the cutter at that depth, to within a texel', () => {
    const gl = context();
    const carve = createCarve(gl, 1024);
    carve.load(carveMesh(straightGroove(0.2), cutter));
    carve.carve();
    const h = carve.heights();
    const texel = texelOf(carve);
    const col = column(h, carve, 0);
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
    for (let i = 0; i < b.passes[0].uvh.length; i += 3) {
      const x = b.passes[0].uvh[i];
      b.passes[0].uvh[i] = 0;
      b.passes[0].uvh[i + 1] = x;
    }
    carve.load(carveMesh({ ...a, passes: [a.passes[0], b.passes[0]] }, cutter));
    carve.carve();
    const h = carve.heights();
    const mid = Math.floor(carve.width / 2);
    expect(Math.abs(h[mid * carve.width + mid] + 0.2)).toBeLessThan(texelOf(carve));
  });

  it('carves only as far as the progress says', () => {
    const gl = context();
    const carve = createCarve(gl, 512);
    carve.load(carveMesh(straightGroove(0.2), cutter));
    carve.carve({ pass: 0, sample: 10 });
    const h = carve.heights();
    const row = Math.floor(carve.height / 2);
    const at = (u: number) => h[row * carve.width + Math.floor(((u - carve.bounds.u[0]) / (carve.bounds.u[1] - carve.bounds.u[0])) * carve.width)];
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

  it('carves a groove round a barrel across its seam, with no gap', () => {
    const gl = context();
    const carve = createCarve(gl, 1024);
    const t = computeToolpaths({ ...PRESETS.barrel, rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } }, pump: null, job: { ...PRESETS.barrel.job, from: 8, to: 8 }, samplesPerTurn: 720 });
    carve.load(carveMesh(t, PRESETS.barrel.cutter));
    expect(carve.width).toBeGreaterThan(carve.height);
    carve.carve();
    const h = carve.heights();
    const row = Math.floor(((8 - carve.bounds.v[0]) / (carve.bounds.v[1] - carve.bounds.v[0])) * carve.height);
    let shallowest = -Infinity;
    for (let x = 0; x < carve.width; x++) shallowest = Math.max(shallowest, h[row * carve.width + x]);
    // texel centers straddle the tip line, so allow half a texel of V
    expect(shallowest).toBeLessThan(-0.15 + texelOf(carve));
    expect(gl.getError()).toBe(gl.NO_ERROR);
    carve.dispose();
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
