import { compile, FULLSCREEN_VERTEX } from './program';
import type { CarveMesh, SheetBounds } from './mesh';

/** How far the carve has got: every pass before `pass` in full, and `pass`
 *  itself up to sample `sample`. */
export interface CarveProgress {
  pass: number;
  sample: number;
}

export interface Carve {
  /** Texels along the sheet's longer side; the shorter gets as many as keep
   *  texels square. */
  readonly resolution: number;
  /** Heights as depth: 1 is the uncut surface, 0 is the mesh's floor. */
  readonly depth: WebGLTexture;
  /** The texture's size in texels, u by v. */
  readonly width: number;
  readonly height: number;
  readonly bounds: SheetBounds;
  /** How far the sheet repeats in u, mm; 0 when it does not. */
  readonly period: number;
  readonly floor: number;
  load(mesh: CarveMesh): void;
  carve(upTo?: CarveProgress): void;
  /** Heights in mm, `width` per row, rows from the sheet's −v edge; for
   *  tests and export. */
  heights(): Float32Array;
  dispose(): void;
}

const CARVE_VERTEX = `#version 300 es
in vec3 position;
uniform vec4 bounds;
uniform float shift;
uniform float floor_;
void main() {
  vec2 at = (position.xy + vec2(shift, 0.0) - bounds.xy) / (bounds.zw - bounds.xy);
  gl_Position = vec4(at * 2.0 - 1.0, 1.0 - 2.0 * position.z / floor_, 1.0);
}`;

const CARVE_FRAGMENT = `#version 300 es
void main() {}`;

const READ_FRAGMENT = `#version 300 es
precision highp float;
uniform highp sampler2D depth;
uniform float floor_;
out vec4 height;
void main() {
  float d = texelFetch(depth, ivec2(gl_FragCoord.xy), 0).r;
  height = vec4(floor_ * (1.0 - d), 0.0, 0.0, 1.0);
}`;

/** Carves toolpath meshes into a depth texture: an orthographic view straight
 *  down onto the work, where the depth test keeps the deepest cut per texel. */
export function createCarve(gl: WebGL2RenderingContext, resolution = 4096): Carve {
  const max: number = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (!(Number.isInteger(resolution) && resolution >= 1 && resolution <= max))
    throw new Error(`rosee/gl: carve resolution must be a whole number from 1 to ${max} on this GPU, got ${resolution}`);
  const carveProgram = compile(gl, CARVE_VERTEX, CARVE_FRAGMENT);
  const readProgram = compile(gl, FULLSCREEN_VERTEX, READ_FRAGMENT);
  const framebuffer = gl.createFramebuffer();
  let depth = gl.createTexture();
  let width = 0;
  let height = 0;
  // A depth texture's storage is immutable, so a new shape needs a new texture.
  const allocate = (w: number, h: number) => {
    if (w === width && h === height) return;
    gl.deleteTexture(depth);
    depth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depth);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error(`rosee/gl: this GPU cannot carve into a ${w}×${h} depth texture (framebuffer status 0x${status.toString(16)})`);
    width = w;
    height = h;
  };
  try {
    allocate(resolution, resolution);
  } catch (e) {
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(depth);
    gl.deleteProgram(carveProgram);
    gl.deleteProgram(readProgram);
    throw e;
  }

  const vao = gl.createVertexArray();
  const positionAt = gl.getAttribLocation(carveProgram, 'position');
  let buffers: { buffer: WebGLBuffer; count: number; perSegment: number }[] = [];
  let bounds: SheetBounds = { u: [-1, 1], v: [-1, 1] };
  let period = 0;
  let floor = -1;

  const carve: Carve = {
    resolution,
    get depth() {
      return depth;
    },
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get bounds() {
      return bounds;
    },
    get period() {
      return period;
    },
    get floor() {
      return floor;
    },
    load(mesh) {
      for (const b of buffers) gl.deleteBuffer(b.buffer);
      buffers = mesh.passes.map((p) => {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, p.vertices, gl.STATIC_DRAW);
        return { buffer, count: p.vertices.length / 3, perSegment: p.vertsPerSegment };
      });
      bounds = mesh.bounds;
      period = mesh.period;
      floor = mesh.floor;
      const du = bounds.u[1] - bounds.u[0];
      const dv = bounds.v[1] - bounds.v[0];
      const short = (a: number, b: number) => Math.max(1, Math.min(resolution, Math.round((resolution * a) / b)));
      allocate(du >= dv ? resolution : short(du, dv), dv >= du ? resolution : short(dv, du));
    },
    carve(upTo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, width, height);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.clearDepth(1);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(carveProgram);
      gl.uniform4f(gl.getUniformLocation(carveProgram, 'bounds'), bounds.u[0], bounds.v[0], bounds.u[1], bounds.v[1]);
      gl.uniform1f(gl.getUniformLocation(carveProgram, 'floor_'), floor);
      const shiftAt = gl.getUniformLocation(carveProgram, 'shift');
      // A pass unbroken across a barrel's seam runs up to a period past the
      // bounds either way, and may start up to one out; two periods each way covers it.
      const shifts = period > 0 ? [-2, -1, 0, 1, 2].map((k) => k * period) : [0];
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(positionAt);
      const last = upTo ? Math.min(upTo.pass, buffers.length - 1) : buffers.length - 1;
      for (let k = 0; k <= last; k++) {
        const b = buffers[k];
        const count = upTo && k === upTo.pass ? Math.min(b.count, Math.max(0, upTo.sample) * b.perSegment) : b.count;
        if (count === 0) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
        gl.vertexAttribPointer(positionAt, 3, gl.FLOAT, false, 0, 0);
        for (const shift of shifts) {
          gl.uniform1f(shiftAt, shift);
          gl.drawArrays(gl.TRIANGLES, 0, count);
        }
      }
      gl.bindVertexArray(null);
      gl.disable(gl.DEPTH_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    heights() {
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('rosee/gl: heights() needs EXT_color_buffer_float');
      const target = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, height);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
      gl.viewport(0, 0, width, height);
      gl.useProgram(readProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, depth);
      gl.uniform1i(gl.getUniformLocation(readProgram, 'depth'), 0);
      gl.uniform1f(gl.getUniformLocation(readProgram, 'floor_'), floor);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const rgba = new Float32Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, rgba);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(target);
      const out = new Float32Array(width * height);
      for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4];
      return out;
    },
    dispose() {
      for (const b of buffers) gl.deleteBuffer(b.buffer);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(depth);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(carveProgram);
      gl.deleteProgram(readProgram);
    },
  };
  return carve;
}
