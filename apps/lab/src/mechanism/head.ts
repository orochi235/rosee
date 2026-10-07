import type { Settings } from 'rosee';
import type * as THREE from 'three';
import type { PartKey } from './parts';
import type { MachinePose } from './pose';

/** What holds and moves the work on one kind of engine, hung off the shared
 *  frame's spindle and headstock. */
export interface Head {
  parts: [PartKey, THREE.Mesh[]][];
  /** The work frame, which the cut trail rides in. */
  work: THREE.Group;
  show(on: boolean): void;
  update(settings: Settings, pose: MachinePose, spindle: number): void;
}

export type Metal = (color: string) => THREE.MeshStandardMaterial;
