import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

/** The cut so far as a line `width` px wide, `fresh` at the graver and
 *  shading to `old` over the last `turns`. */
export interface TrailLine {
  object: THREE.Object3D;
  /** The whole cut, from `cutPath`, and how many points make a turn. */
  path(xy: Float32Array, perTurn: number): void;
  /** Draws the path up to point `end`. */
  cut(end: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export function createTrailLine(fresh: string, old: string, width: number, turns = 1): TrailLine {
  const geometry = new LineSegmentsGeometry();
  const material = new LineMaterial({ linewidth: width, vertexColors: true });
  const line = new LineSegments2(geometry, material);
  line.frustumCulled = false;
  const from = new THREE.Color(fresh);
  const to = new THREE.Color(old);
  const rgb = new THREE.Color();

  let colors = new Float32Array(0);
  let colorBuffer: THREE.InstancedInterleavedBuffer | null = null;
  let segments = 0;
  let span = 1;
  // The lowest segment the last `cut` shaded; everything from it up may need recoloring.
  let shaded = 0;

  const paint = (k: number, end: number) => {
    for (let v = 0; v < 2; v++) {
      rgb.lerpColors(from, to, Math.min(1, (end - k - v) / span));
      colors.set([rgb.r, rgb.g, rgb.b], k * 6 + v * 3);
    }
  };

  return {
    object: line,
    path(xy, perTurn) {
      segments = xy.length / 2 - 1;
      span = Math.max(1, perTurn * turns);
      const ends = new Float32Array(segments * 6);
      for (let k = 0; k < segments; k++) ends.set([xy[k * 2], xy[k * 2 + 1], 0, xy[k * 2 + 2], xy[k * 2 + 3], 0], k * 6);
      colors = new Float32Array(segments * 6);
      for (let k = 0; k < segments; k++) colors.set([to.r, to.g, to.b, to.r, to.g, to.b], k * 6);
      geometry.dispose();
      const endBuffer = new THREE.InstancedInterleavedBuffer(ends, 6, 1);
      colorBuffer = new THREE.InstancedInterleavedBuffer(colors, 6, 1).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('instanceStart', new THREE.InterleavedBufferAttribute(endBuffer, 3, 0));
      geometry.setAttribute('instanceEnd', new THREE.InterleavedBufferAttribute(endBuffer, 3, 3));
      geometry.setAttribute('instanceColorStart', new THREE.InterleavedBufferAttribute(colorBuffer, 3, 0));
      geometry.setAttribute('instanceColorEnd', new THREE.InterleavedBufferAttribute(colorBuffer, 3, 3));
      geometry.instanceCount = 0;
      shaded = 0;
    },
    cut(end) {
      const drawn = Math.max(0, Math.min(end, segments));
      const low = Math.max(0, drawn - Math.ceil(span));
      for (let k = Math.min(shaded, low); k < drawn; k++) paint(k, drawn);
      shaded = low;
      if (colorBuffer) colorBuffer.needsUpdate = true;
      geometry.instanceCount = drawn;
    },
    resize(width, height) {
      material.resolution.set(width, height);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
