import { SAMPLES_PER_TURN } from 'rosee';
import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { Trail } from './trail';

/** The recent cut as a line `width` px wide, fading with age. */
export interface TrailLine {
  object: THREE.Object3D;
  set(trail: Trail): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const SEGMENTS = SAMPLES_PER_TURN.max;

export function createTrailLine(color: string, width: number): TrailLine {
  // Allocated once at the most a trail can hold, and rewritten in place.
  const ends = new THREE.InstancedInterleavedBuffer(new Float32Array(SEGMENTS * 6), 6, 1).setUsage(THREE.DynamicDrawUsage);
  const colors = new THREE.InstancedInterleavedBuffer(new Float32Array(SEGMENTS * 8), 8, 1).setUsage(THREE.DynamicDrawUsage);
  const geometry = new LineSegmentsGeometry();
  geometry.setAttribute('instanceStart', new THREE.InterleavedBufferAttribute(ends, 3, 0));
  geometry.setAttribute('instanceEnd', new THREE.InterleavedBufferAttribute(ends, 3, 3));
  geometry.setAttribute('instanceColorStart', new THREE.InterleavedBufferAttribute(colors, 4, 0));
  geometry.setAttribute('instanceColorEnd', new THREE.InterleavedBufferAttribute(colors, 4, 4));
  geometry.instanceCount = 0;

  const material = new LineMaterial({ linewidth: width, vertexColors: true, transparent: true, depthWrite: false });
  // Three's fat lines carry rgb per vertex; widen it to rgba so the fade is alpha, not a guess at the face's color.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('attribute vec3 instanceColorStart;', 'attribute vec4 instanceColorStart;')
      .replace('attribute vec3 instanceColorEnd;', 'attribute vec4 instanceColorEnd;')
      .replace('vColor.xyz = ( position.y < 0.5 )', 'vColor = ( position.y < 0.5 )');
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
      'gl_FragColor = vec4( diffuseColor.rgb, alpha * vColor.a );',
    );
  };

  const line = new LineSegments2(geometry, material);
  line.frustumCulled = false;
  const rgb = new THREE.Color(color);

  return {
    object: line,
    set({ xy, age }) {
      const n = Math.min(age.length - 1, SEGMENTS);
      const e = ends.array as Float32Array;
      const c = colors.array as Float32Array;
      for (let k = 0; k < n; k++) {
        e.set([xy[k * 2], xy[k * 2 + 1], 0, xy[k * 2 + 2], xy[k * 2 + 3], 0], k * 6);
        c.set([rgb.r, rgb.g, rgb.b, (1 - age[k]) ** 2, rgb.r, rgb.g, rgb.b, (1 - age[k + 1]) ** 2], k * 8);
      }
      ends.needsUpdate = true;
      colors.needsUpdate = true;
      geometry.instanceCount = Math.max(n, 0);
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
