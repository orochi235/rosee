import { machineToHeadstock, type Rosette, rubberReach, type Settings } from 'rosee';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PALETTE } from '../palette';
import type { PartKey } from './parts';
import { followingRubber, type MachinePose } from './pose';
import { createInset } from './inset';
import { createTrailLine } from './trailLine';
import { rosetteGeometry } from './rosetteGeometry';

/** A crude rose engine in three.js, in machine-frame mm: x toward the rubber
 *  and cutter, y up, z along the spindle toward the cutter. It exists to make
 *  a wrong motion obvious, so every part moves from the same pose the 2D
 *  views draw, except that the swing is magnified `exaggerate` times to be
 *  seen, and the rubber is moved by as much as that moves the contact so the
 *  two still touch rather than the rosette swinging through it. */
export interface MachineScene {
  update(settings: Settings, pose: MachinePose, spindle: number, exaggerate: number): void;
  /** The whole cut, from `cutPath`, and how many of its points make a turn. */
  path(xy: Float32Array, perTurn: number): void;
  /** Draws the cut on the work's face up to point `end` of the path. */
  cut(end: number): void;
  /** The part under a point given in the canvas's CSS pixels, or null. */
  pick(x: number, y: number): PartKey | null;
  /** Tints one part to show it is the one being explained. */
  highlight(part: PartKey | null): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const ROSETTE_Z = -40;

/** Where the camera sits and what it orbits, in machine-frame mm. */
export interface CameraPlacement {
  position: [number, number, number];
  target: [number, number, number];
}

/** The spindle head close up, for the lab's tile. */
export const CLOSE_UP: CameraPlacement = { position: [110, 50, 170], target: [0, -10, -20] };
/** Bed to rosette, so the rocking reads as the whole headstock moving. */
export const WHOLE_MACHINE: CameraPlacement = { position: [250, 40, 290], target: [20, -60, -30] };

export function createMachineScene(
  canvas: HTMLCanvasElement,
  placement: CameraPlacement = CLOSE_UP,
  { transparent = false, inset = false } = {},
): MachineScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: transparent });
  renderer.setPixelRatio(window.devicePixelRatio);
  const scene = new THREE.Scene();
  if (!transparent) scene.background = new THREE.Color(PALETTE.background);
  scene.add(new THREE.HemisphereLight('#ffffff', PALETTE.ground, 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(80, 120, 160);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
  camera.position.set(...placement.position);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...placement.target);
  controls.update();

  // Each mesh gets its own material so one part can glow alone.
  const metal = (color: string) => new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 });

  const bed = new THREE.Mesh(new THREE.BoxGeometry(260, 10, 160), metal(PALETTE.faint));
  scene.add(bed);
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 120, 24).rotateX(Math.PI / 2), metal(PALETTE.steel));
  scene.add(pivot);

  // Everything that rocks hangs off the pivot; the pump slides it along z.
  const headstock = new THREE.Group();
  scene.add(headstock);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 70), metal(PALETTE.steel));
  headstock.add(arm);
  const spindle = new THREE.Group();
  headstock.add(spindle);
  spindle.add(
    new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 90, 24).rotateX(Math.PI / 2).translate(0, 0, -51), metal(PALETTE.steel)),
  );
  const rosette = new THREE.Mesh(
    rosetteGeometry({ radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1 } }),
    metal(PALETTE.rosette),
  );
  rosette.position.z = ROSETTE_Z;
  spindle.add(rosette);
  const work = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 6, 64).rotateX(Math.PI / 2).translate(0, 0, -3), metal(PALETTE.work));
  // The chuck sits back on the spindle by the index; the work rides its slide.
  const chuck = new THREE.Group();
  spindle.add(chuck);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 3).translate(0, 0, -7.5), metal(PALETTE.steel));
  chuck.add(slide);
  const carrier = new THREE.Group();
  chuck.add(carrier);
  carrier.add(work);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.5), metal(PALETTE.steep));
  carrier.add(mark);
  const trail = createTrailLine(PALETTE.trailNew, PALETTE.trailOld, 1.5);
  // Just proud of the face, so it never fights the face for depth.
  trail.object.position.z = 0.05;
  carrier.add(trail.object);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 12, 96), metal(PALETTE.steel));
  headstock.add(ring);

  const rubber = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8, 24).rotateX(Math.PI / 2), metal(PALETTE.rubber));
  rubber.position.z = ROSETTE_Z + 2;
  scene.add(rubber);
  const cutter = new THREE.Mesh(new THREE.ConeGeometry(2.5, 14, 4).rotateX(-Math.PI / 2).translate(0, 0, 7), metal(PALETTE.cutter));
  scene.add(cutter);

  const parts = new Map<PartKey, THREE.Mesh[]>([
    ['bed', [bed]],
    ['pivot', [pivot]],
    ['headstock', [arm]],
    ['spindle', [spindle.children[0] as THREE.Mesh]],
    ['rosette', [rosette]],
    ['work', [work, mark]],
    ['chuck', [slide]],
    ['ring', [ring]],
    ['rubber', [rubber]],
    ['cutter', [cutter]],
  ]);
  for (const [key, meshes] of parts) for (const m of meshes) m.userData.part = key;
  const raycaster = new THREE.Raycaster();

  let shownRosette: Rosette | null = null;
  const closeUp = inset ? createInset(renderer, scene, PALETTE.background, PALETTE.faint) : null;
  let width = 1;
  let height = 1;
  let frame = 0;
  const requestRender = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      renderer.render(scene, camera);
      if (!closeUp) return;
      // Fat lines are sized against the viewport they draw into.
      closeUp.render(width, height, (w, h) => trail.resize(w, h));
      trail.resize(width, height);
    });
  };
  controls.addEventListener('change', requestRender);

  return {
    update(settings, pose, spindleAngle, exaggerate) {
      const P = settings.pivotDistance;
      if (settings.rosette !== shownRosette) {
        rosette.geometry.dispose();
        rosette.geometry = rosetteGeometry(settings.rosette);
        shownRosette = settings.rosette;
      }
      bed.position.set(0, -P - 12, -20);
      pivot.position.set(0, -P, -20);
      headstock.position.set(0, -P, pose.pump * exaggerate);
      headstock.rotation.z = pose.swing * exaggerate;
      arm.scale.y = P;
      arm.position.set(0, P / 2, -40);
      spindle.position.set(0, P, 0);
      spindle.rotation.z = spindleAngle;
      rosette.rotation.z = pose.phase;
      const ch = pose.chuck;
      chuck.rotation.z = pose.slideAngle - spindleAngle;
      slide.visible = ch !== null;
      // Longer than the work is wide, and the ring wider, so both show past it.
      slide.scale.x = 2.6 * pose.stock;
      carrier.position.set(ch?.slide ?? 0, 0, 0);
      carrier.rotation.z = ch?.wheel ?? 0;
      ring.visible = ch?.ring != null;
      if (ch?.ring) {
        const [hx, hy] = machineToHeadstock(ch.ring, P, pose.swing);
        ring.position.set(hx, hy + P, -11);
        ring.scale.setScalar(pose.stock * 1.25);
      }
      work.scale.set(pose.stock, pose.stock, 1);
      mark.scale.set(pose.stock * 0.9, 1.2, 1);
      mark.position.set((pose.stock * 0.9) / 2, 0, 0.3);
      // A knife edge is drawn with some thickness, set back so its face, not
      // its middle, is where the edge touches.
      const reach = rubberReach(settings.rubber);
      const drawn = Math.max(reach, 0.6);
      rubber.scale.set(drawn, drawn, 1);
      const [rx, ry] = followingRubber(pose, P, exaggerate);
      rubber.position.set(rx + drawn - reach, ry, ROSETTE_Z + 2);
      cutter.position.set(pose.cutter[0], pose.cutter[1], 0);
      closeUp?.aim(pose.cutter, pose.stock);
      requestRender();
    },
    path(xy, perTurn) {
      trail.path(xy, perTurn);
      requestRender();
    },
    cut(end) {
      trail.cut(end);
      requestRender();
    },
    pick(x, y) {
      const ndc = new THREE.Vector2((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects([...parts.values()].flat().filter((m) => m.visible), false)[0];
      return (hit?.object.userData.part as PartKey | undefined) ?? null;
    },
    highlight(part) {
      for (const [key, meshes] of parts) {
        for (const m of meshes) (m.material as THREE.MeshStandardMaterial).emissive.set(key === part ? PALETTE.glow : '#000000');
      }
      requestRender();
    },
    resize(w, h) {
      width = w;
      height = h;
      renderer.setSize(width, height, false);
      trail.resize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      requestRender();
    },
    dispose() {
      cancelAnimationFrame(frame);
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      });
      trail.dispose();
      renderer.dispose();
    },
  };
}
