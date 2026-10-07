import { rad } from '../angle';
import { reachOf, type Surface } from '../surface/surface';
import type { Carve } from './carve';
import { METAL_GLSL, SHEET_GLSL } from './glsl';
import { compile } from './program';
import type { Light, Metal } from './shade';

/** A camera turning round the part: `yaw` round its vertical axis and
 *  `pitch` above it, degrees; `zoom` 1 frames the whole part. */
export interface Orbit {
  yaw: number;
  pitch: number;
  zoom: number;
}

export const DEFAULT_ORBIT: Orbit = { yaw: 35, pitch: 25, zoom: 1 };

const PART_GLSL = `
uniform highp int kind;
uniform vec2 shape;

/** The work-frame point at sheet point (u, v) and height h, as fromSheet. */
vec3 fromSheet(vec2 p, float h) {
  if (kind == 1) {
    float a = p.x / shape.x;
    return vec3((shape.x + h) * cos(a), (shape.x + h) * sin(a), -p.y);
  }
  if (kind == 2) {
    float arc = length(p);
    float g = arc / shape.x;
    float r = shape.x + h;
    float k = arc > 0.0 ? r * sin(g) / arc : 1.0;
    return vec3(p * k, -shape.x + r * cos(g));
  }
  return vec3(p, h);
}
`;

const PART_VERTEX = `#version 300 es
precision highp float;
in vec2 grid;
uniform vec4 range;
uniform mat4 viewProjection;
out vec2 sheet;
${PART_GLSL}
void main() {
  sheet = mix(range.xy, range.zw, grid);
  gl_Position = viewProjection * vec4(fromSheet(sheet, 0.0), 1.0);
}`;

const PART_FRAGMENT = `#version 300 es
precision highp float;
uniform highp sampler2D depth;
uniform float floor_;
uniform vec4 bounds;
uniform float period;
uniform vec2 texels;
uniform vec3 light;
uniform vec3 metal;
uniform float roughness;
uniform vec3 eye;
uniform float limit;
uniform float outward;
in vec2 sheet;
out vec4 color;
${PART_GLSL}
${SHEET_GLSL}
${METAL_GLSL}
void main() {
  if (kind != 1 && length(sheet) > limit) discard;
  vec3 hs = heightAndSlope(sheet);
  // the carved surface's tangents, a small step either way along u and v
  float e = 0.01;
  vec3 du = fromSheet(sheet + vec2(e, 0.0), hs.x + hs.y * e) - fromSheet(sheet - vec2(e, 0.0), hs.x - hs.y * e);
  vec3 dv = fromSheet(sheet + vec2(0.0, e), hs.x + hs.z * e) - fromSheet(sheet - vec2(0.0, e), hs.x - hs.z * e);
  vec3 n = outward * normalize(cross(du, dv));
  vec3 p = fromSheet(sheet, hs.x);
  vec3 v = normalize(eye - p);
  if (dot(n, v) < 0.0) n = -n;
  vec3 lit = litMetal(n, v, light);
  color = vec4(pow(lit / (1.0 + lit), vec3(1.0 / 2.2)), 1.0);
}`;

/** Cells along each side of the grid the part is drawn from. Its silhouette
 *  is the uncut surface; the cut shows in the light, per pixel. */
const GRID = 256;

type Mat4 = Float32Array;

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  return out;
}

function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

function lookAt(eye: number[], target: number[], up: number[]): Mat4 {
  const norm = (v: number[]) => {
    const l = Math.hypot(...v);
    return v.map((x) => x / l);
  };
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const z = norm(eye.map((x, i) => x - target[i]));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}

/** The part's sheet, its center and its size, for framing: a face out to
 *  the carve, a barrel its whole length, a dome out to its rim. */
function framing(surface: Surface, carve: Carve): { range: [number, number, number, number]; limit: number; center: number[]; size: number } {
  switch (surface.kind) {
    case 'flat': {
      const e = Math.max(-carve.bounds.u[0], carve.bounds.u[1]);
      return { range: [-e, -e, e, e], limit: e, center: [0, 0, 0], size: e };
    }
    case 'cylinder': {
      const R = surface.radius;
      return {
        range: [-Math.PI * R, 0, Math.PI * R, surface.length],
        limit: 1e9,
        center: [0, 0, -surface.length / 2],
        size: Math.hypot(R, surface.length / 2),
      };
    }
    case 'dome': {
      const arc = reachOf(surface);
      const sag = surface.radius - Math.sqrt(surface.radius ** 2 - surface.rim ** 2);
      return { range: [-arc, -arc, arc, arc], limit: arc, center: [0, 0, -sag / 2], size: Math.hypot(surface.rim, sag / 2) };
    }
  }
}

export interface Part {
  /** Draws the carved part, lit, into the default framebuffer. `background`
   *  is linear RGB like a metal's color. */
  render(carve: Carve, surface: Surface, orbit: Orbit, light: Light, metal: Metal, background?: [number, number, number]): void;
  dispose(): void;
}

const KINDS: Record<Surface['kind'], number> = { flat: 0, cylinder: 1, dome: 2 };

/** The carved part in 3D: the uncut surface as a grid wrapped from the sheet,
 *  lit per pixel from the carve's heights in the same context, so no height
 *  is read back. The light is fixed to the work, as in the flat view. */
export function createPart(gl: WebGL2RenderingContext): Part {
  const program = compile(gl, PART_VERTEX, PART_FRAGMENT);
  const u = (name: string) => gl.getUniformLocation(program, name);
  const grid = new Float32Array(GRID * GRID * 12);
  let o = 0;
  for (let j = 0; j < GRID; j++)
    for (let i = 0; i < GRID; i++) {
      const [a, b, c, d] = [i / GRID, (i + 1) / GRID, j / GRID, (j + 1) / GRID];
      grid.set([a, c, b, c, a, d, a, d, b, c, b, d], o);
      o += 12;
    }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const gridAt = gl.getAttribLocation(program, 'grid');
  gl.enableVertexAttribArray(gridAt);
  gl.vertexAttribPointer(gridAt, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  return {
    render(carve, surface, orbit, light, metal, background = [0.006, 0.006, 0.008]) {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const frame = framing(surface, carve);
      const fov = rad(30);
      const distance = (frame.size / Math.sin(fov / 2)) * 1.1 / Math.max(orbit.zoom, 1e-3);
      const [yaw, pitch] = [rad(orbit.yaw), rad(orbit.pitch)];
      const eye = [
        frame.center[0] + distance * Math.sin(yaw) * Math.cos(pitch),
        frame.center[1] + distance * Math.sin(pitch),
        frame.center[2] + distance * Math.cos(yaw) * Math.cos(pitch),
      ];
      const view = lookAt(eye, frame.center, [0, 1, 0]);
      const projection = perspective(fov, w / Math.max(h, 1), distance / 100, distance + frame.size * 4);
      const [az, el] = [rad(light.azimuth), rad(light.elevation)];
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      const bg = background.map((c) => Math.pow(c, 1 / 2.2));
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, carve.depth);
      gl.uniform1i(u('depth'), 0);
      gl.uniform1f(u('floor_'), carve.floor);
      gl.uniform4f(u('bounds'), carve.bounds.u[0], carve.bounds.v[0], carve.bounds.u[1], carve.bounds.v[1]);
      gl.uniform1f(u('period'), carve.period);
      gl.uniform2f(u('texels'), carve.width, carve.height);
      gl.uniform1i(u('kind'), KINDS[surface.kind]);
      gl.uniform2f(u('shape'), surface.kind === 'flat' ? 0 : surface.radius, 0);
      gl.uniform4f(u('range'), ...frame.range);
      gl.uniform1f(u('limit'), frame.limit);
      gl.uniform1f(u('outward'), surface.kind === 'cylinder' ? -1 : 1);
      gl.uniformMatrix4fv(u('viewProjection'), false, multiply(projection, view));
      gl.uniform3f(u('eye'), eye[0], eye[1], eye[2]);
      gl.uniform3f(u('light'), Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
      gl.uniform3f(u('metal'), ...metal.color);
      gl.uniform1f(u('roughness'), metal.roughness);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, GRID * GRID * 6);
      gl.bindVertexArray(null);
      gl.disable(gl.DEPTH_TEST);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
