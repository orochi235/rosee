/** A WebGL2 context on a detached canvas. */
export function context(size = 256): WebGL2RenderingContext {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('no WebGL2');
  return gl;
}
