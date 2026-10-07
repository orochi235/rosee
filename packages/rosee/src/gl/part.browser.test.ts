import { describe, expect, it } from 'vitest';
import { PRESETS } from '../presets';
import type { Surface } from '../surface/surface';
import { computeToolpaths } from '../toolpath/toolpath';
import { createCarve } from './carve';
import { context } from './fixtures/context';
import { carveMesh } from './mesh';
import { createPart, DEFAULT_ORBIT } from './part';
import { METALS } from './shade';

const BACKGROUND: [number, number, number] = [0, 0, 0];

describe('createPart', () => {
  for (const name of ['swirl', 'barrel', 'dome'] as const) {
    it(`draws the ${name} part in the middle of the canvas, leaving the corners background`, () => {
      const gl = context(128);
      const s = { ...PRESETS[name], samplesPerTurn: 256 };
      const carve = createCarve(gl, 512);
      carve.load(carveMesh(computeToolpaths(s), s.cutter));
      carve.carve();
      const part = createPart(gl);
      part.render(carve, s.surface as Surface, DEFAULT_ORBIT, { azimuth: 120, elevation: 35 }, METALS.silver, BACKGROUND);
      const px = new Uint8Array(4 * 128 * 128);
      gl.readPixels(0, 0, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const at = (x: number, y: number) => px[(y * 128 + x) * 4] + px[(y * 128 + x) * 4 + 1];
      expect(gl.getError()).toBe(gl.NO_ERROR);
      expect(at(64, 64)).toBeGreaterThan(0);
      expect(at(1, 1)).toBe(0);
      part.dispose();
      carve.dispose();
    });
  }
});
