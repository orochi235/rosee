import type { PassPath, Toolpaths } from '../../toolpath/toolpath';

/** A straight groove along x at depth `depth`, the V opening across y. */
export function straightGroove(depth: number, length = 10, samples = 20): Toolpaths {
  const n = samples + 1;
  const xyz = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) xyz.set([-length / 2 + (length * i) / samples, 0, -depth], i * 3);
  const path: PassPath = {
    pass: { radius: 0, depth, phase: 0, pumpPhase: 0, index: 0, wheel: 0, eccentricity: 0 },
    xyz,
    swing: new Float32Array(n),
    pump: new Float32Array(n),
    contact: new Float32Array(n),
    steep: new Uint8Array(n),
    across: new Float32Array(n).fill(Math.PI / 2),
    slide: new Float32Array(n),
  };
  return { samples, rubberX: 30, pumpX: null, passes: [path] };
}
