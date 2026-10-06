import { rad } from '../angle';
import type { Carve } from './carve';
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
uniform float extent;
uniform float resolution;
uniform vec2 center;
uniform float mmPerPixel;
uniform vec2 canvas;
uniform vec3 light;
uniform vec3 metal;
uniform float roughness;
uniform vec3 background;
out vec4 color;

float heightAt(ivec2 t) {
  ivec2 c = clamp(t, ivec2(0), ivec2(int(resolution) - 1));
  return floor_ * (1.0 - texelFetch(depth, c, 0).r);
}

vec3 shadeAt(vec2 mm) {
  vec2 uv = clamp((mm / extent + 1.0) * 0.5, vec2(0.0), vec2(1.0 - 0.5 / resolution));
  ivec2 t = ivec2(uv * resolution);
  float texel = 2.0 * extent / resolution;
  float dx = (heightAt(t + ivec2(1, 0)) - heightAt(t - ivec2(1, 0))) / (2.0 * texel);
  float dy = (heightAt(t + ivec2(0, 1)) - heightAt(t - ivec2(0, 1))) / (2.0 * texel);
  vec3 n = normalize(vec3(-dx, -dy, 1.0));
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 h = normalize(light + v);
  float a2 = roughness * roughness * roughness * roughness;
  float nh = max(dot(n, h), 0.0);
  float d = a2 / (3.14159265 * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
  float nl = max(dot(n, light), 0.0);
  vec3 fresnel = metal + (1.0 - metal) * pow(1.0 - max(dot(h, v), 0.0), 5.0);
  // a dim sky reflected by every facet, so the stock reads as metal away from the highlight
  return metal * (0.12 + 0.18 * n.z * n.z) + fresnel * d * nl * 0.5;
}

void main() {
  vec2 here = center + (gl_FragCoord.xy - 0.5 * canvas) * mmPerPixel;
  if (any(greaterThan(abs(here), vec2(extent)))) {
    color = vec4(pow(background, vec3(1.0 / 2.2)), 1.0);
    return;
  }
  // average the pixel's footprint: a pixel wider than a texel sees many facets at once
  float texel = 2.0 * extent / resolution;
  int k = int(clamp(ceil(mmPerPixel / texel), 1.0, 6.0));
  vec3 sum = vec3(0.0);
  for (int j = 0; j < k; j++) {
    for (int i = 0; i < k; i++) {
      vec2 sub = (vec2(float(i), float(j)) + 0.5) / float(k) - 0.5;
      sum += shadeAt(center + (gl_FragCoord.xy + sub - 0.5 * canvas) * mmPerPixel);
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
      gl.uniform1f(u('extent'), carve.extent);
      gl.uniform1f(u('resolution'), carve.resolution);
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
