import { describe, expect, it } from 'vitest';
import { createCarve } from './carve';
import { context } from './fixtures/context';
import { straightGroove } from './fixtures/straightGroove';
import { carveMesh } from './mesh';
import { createShade, METALS } from './shade';

describe('createShade', () => {
  it('lights a groove differently from the uncut surface', () => {
    const gl = context(256);
    const carve = createCarve(gl, 512);
    carve.load(carveMesh(straightGroove(0.2), { vAngle: 90, tipFlat: 0 }));
    carve.carve();
    const shade = createShade(gl);
    // a low light: its half vector sits near the 45° flank's normal and far from the flat's
    shade.render(carve, { center: [0, 0], mmPerPixel: 0.01 }, { azimuth: 90, elevation: 20 }, METALS.silver);
    const px = new Uint8Array(4 * 256 * 256);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const at = (x: number, y: number) => px[(y * 256 + x) * 4];
    expect(gl.getError()).toBe(gl.NO_ERROR);
    // the groove's flank facing the light is brighter than the flat stock beside it
    const flank = Math.max(at(128, 120), at(128, 136));
    expect(flank).toBeGreaterThan(at(128, 10) + 20);
  });
});
