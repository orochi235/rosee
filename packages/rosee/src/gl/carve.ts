import { compile, FULLSCREEN_VERTEX } from './program';
import type { CarveMesh } from './mesh';

/** How far the carve has got: every pass before `pass` in full, and `pass`
 *  itself up to sample `sample`. */
export interface CarveProgress {
  pass: number;
  sample: number;
}

export interface Carve {
  readonly resolution: number;
  /** Heights as depth: 1 is the uncut surface, 0 is the mesh's floor. */
  readonly depth: WebGLTexture;
  readonly extent: number;
  readonly floor: number;
  load(mesh: CarveMesh): void;
  carve(upTo?: CarveProgress): void;
  /** Heights in mm, row by row from the domain's −v edge; for tests and export. */
  heights(): Float32Array;
  dispose(): void;
}

const CARVE_VERTEX = `#version 300 es
in vec3 position;
uniform float extent;
uniform float floor_;
void main() {
  gl_Position = vec4(position.xy / extent, 1.0 - 2.0 * position.z / floor_, 1.0);
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
  const depth = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, depth);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, resolution, resolution);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(depth);
    gl.deleteProgram(carveProgram);
    gl.deleteProgram(readProgram);
    throw new Error(`rosee/gl: this GPU cannot carve into a ${resolution}² depth texture (framebuffer status 0x${status.toString(16)})`);
  }

  const vao = gl.createVertexArray();
  const positionAt = gl.getAttribLocation(carveProgram, 'position');
  let buffers: { buffer: WebGLBuffer; count: number; perSegment: number }[] = [];
  let extent = 1;
  let floor = -1;

  const carve: Carve = {
    resolution,
    depth,
    get extent() {
      return extent;
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
      extent = mesh.extent;
      floor = mesh.floor;
    },
    carve(upTo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, resolution, resolution);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.clearDepth(1);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(carveProgram);
      gl.uniform1f(gl.getUniformLocation(carveProgram, 'extent'), extent);
      gl.uniform1f(gl.getUniformLocation(carveProgram, 'floor_'), floor);
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(positionAt);
      const last = upTo ? Math.min(upTo.pass, buffers.length - 1) : buffers.length - 1;
      for (let k = 0; k <= last; k++) {
        const b = buffers[k];
        const count = upTo && k === upTo.pass ? Math.min(b.count, Math.max(0, upTo.sample) * b.perSegment) : b.count;
        if (count === 0) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
        gl.vertexAttribPointer(positionAt, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, count);
      }
      gl.bindVertexArray(null);
      gl.disable(gl.DEPTH_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    heights() {
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('rosee/gl: heights() needs EXT_color_buffer_float');
      const target = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, resolution, resolution);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
      gl.viewport(0, 0, resolution, resolution);
      gl.useProgram(readProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, depth);
      gl.uniform1i(gl.getUniformLocation(readProgram, 'depth'), 0);
      gl.uniform1f(gl.getUniformLocation(readProgram, 'floor_'), floor);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const rgba = new Float32Array(resolution * resolution * 4);
      gl.readPixels(0, 0, resolution, resolution, gl.RGBA, gl.FLOAT, rgba);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(target);
      const out = new Float32Array(resolution * resolution);
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
