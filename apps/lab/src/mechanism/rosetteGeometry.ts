import { radiusAt, type Rosette, TAU } from 'rosee';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ROSETTE_POINTS = 1440;
const ROSETTE_THICKNESS = 4;

/** The rosette as a plate: flat faces, and a rim whose normals follow the
 *  outline so it shades smoothly rather than in one flat strip per segment,
 *  which is what an extrusion gives. */
export function rosetteGeometry(r: Rosette): THREE.BufferGeometry {
  const outline: THREE.Vector2[] = [];
  for (let k = 0; k < ROSETTE_POINTS; k++) {
    const a = (k / ROSETTE_POINTS) * TAU;
    const rr = radiusAt(r, a);
    outline.push(new THREE.Vector2(rr * Math.cos(a), rr * Math.sin(a)));
  }
  const n = outline.length;
  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let k = 0; k < n; k++) {
    const prev = outline[(k + n - 1) % n];
    const next = outline[(k + 1) % n];
    const p = outline[k];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    for (const z of [0, ROSETTE_THICKNESS]) {
      position.push(p.x, p.y, z);
      normal.push(ty / len, -tx / len, 0);
      uv.push(k / n, z / ROSETTE_THICKNESS);
    }
    const a = 2 * k;
    const b = 2 * ((k + 1) % n);
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const rim = new THREE.BufferGeometry();
  rim.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  rim.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  rim.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  rim.setIndex(index);
  const shape = new THREE.Shape(outline);
  const front = new THREE.ShapeGeometry(shape).translate(0, 0, ROSETTE_THICKNESS);
  // The back face is the same triangles wound the other way, facing -z.
  const back = new THREE.ShapeGeometry(shape);
  const tris = back.index!.array;
  const reversed: number[] = [];
  for (let i = 0; i < tris.length; i += 3) reversed.push(tris[i], tris[i + 2], tris[i + 1]);
  back.setIndex(reversed);
  const normals = back.getAttribute('normal');
  for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 0, -1);
  return mergeGeometries([rim, front, back])!;
}
