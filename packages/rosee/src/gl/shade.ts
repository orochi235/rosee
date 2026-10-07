import { rad } from '../angle';
import type { Carve } from './carve';
import { METAL_GLSL, SHEET_GLSL } from './glsl';
import { compile, FULLSCREEN_VERTEX } from './program';

/** Which part of the work the canvas shows: the domain point at the canvas's
 *  center, and the size of a canvas pixel, both in mm. */
export interface View {
  center: [number, number];
  mmPerPixel: number;
}

/** A light far away: azimuth around the work and elevation above it, degrees. */
export interface Light {
  azimuth: number;
  elevation: number;
}

/** Linear RGB in [0, 1], and roughness in (0, 1]: low is a mirror polish. */
export interface Metal {
  color: [number, number, number];
  roughness: number;
}

export const METALS = {
  silver: { color: [0.95, 0.93, 0.88], roughness: 0.3 },
  gold: { color: [1.0, 0.78, 0.34], roughness: 0.3 },
  steel: { color: [0.56, 0.57, 0.58], roughness: 0.4 },
} satisfies Record<string, Metal>;

const SHADE_FRAGMENT = `#version 300 es
precision highp float;
uniform highp sampler2D depth;
uniform float floor_;
uniform vec4 bounds;
uniform float period;
uniform vec2 texels;
uniform vec2 center;
uniform float mmPerPixel;
uniform vec2 canvas;
uniform vec3 light;
uniform vec3 metal;
uniform float roughness;
uniform vec3 background;
out vec4 color;

${SHEET_GLSL}
${METAL_GLSL}

vec3 shadeAt(vec2 mm) {
  vec3 hs = heightAndSlope(mm);
  return litMetal(normalize(vec3(-hs.y, -hs.z, 1.0)), vec3(0.0, 0.0, 1.0), light);
}

void main() {
  vec2 here = center + (gl_FragCoord.xy - 0.5 * canvas) * mmPerPixel;
  if (period > 0.0) here.x = bounds.x + mod(here.x - bounds.x, period);
  if (any(lessThan(here, bounds.xy)) || any(greaterThan(here, bounds.zw))) {
    color = vec4(pow(background, vec3(1.0 / 2.2)), 1.0);
    return;
  }
  // average the pixel's footprint: a pixel wider than a texel sees many facets at once
  float texel = (bounds.z - bounds.x) / texels.x;
  int k = int(clamp(ceil(mmPerPixel / texel), 1.0, 6.0));
  vec3 sum = vec3(0.0);
  for (int j = 0; j < k; j++) {
    for (int i = 0; i < k; i++) {
      vec2 sub = (vec2(float(i), float(j)) + 0.5) / float(k) - 0.5;
      sum += shadeAt(here + sub * mmPerPixel);
    }
  }
  vec3 lit = sum / float(k * k);
  color = vec4(pow(lit / (1.0 + lit), vec3(1.0 / 2.2)), 1.0);
}`;

export interface Shade {
  /** `background`, shown outside the carve, is linear RGB like a metal's color. */
  render(carve: Carve, view: View, light: Light, metal: Metal, background?: [number, number, number]): void;
  dispose(): void;
}

/** Lights the carved heights as polished metal into the default framebuffer:
 *  normals from the heights' slopes, a GGX highlight from one distant light. */
export function createShade(gl: WebGL2RenderingContext): Shade {
  const program = compile(gl, FULLSCREEN_VERTEX, SHADE_FRAGMENT);
  const u = (name: string) => gl.getUniformLocation(program, name);
  return {
    render(carve, view, light, metal, background = [0.006, 0.006, 0.008]) {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const az = rad(light.azimuth);
      const el = rad(light.elevation);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, carve.depth);
      gl.uniform1i(u('depth'), 0);
      gl.uniform1f(u('floor_'), carve.floor);
      gl.uniform4f(u('bounds'), carve.bounds.u[0], carve.bounds.v[0], carve.bounds.u[1], carve.bounds.v[1]);
      gl.uniform1f(u('period'), carve.period);
      gl.uniform2f(u('texels'), carve.width, carve.height);
      gl.uniform2f(u('center'), view.center[0], view.center[1]);
      gl.uniform1f(u('mmPerPixel'), view.mmPerPixel);
      gl.uniform2f(u('canvas'), w, h);
      gl.uniform3f(u('light'), Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
      gl.uniform3f(u('metal'), ...metal.color);
      gl.uniform1f(u('roughness'), metal.roughness);
      gl.uniform3f(u('background'), ...background);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
