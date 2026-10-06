import { radiusAt, type Rosette, type Settings, TAU } from 'rosee';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PartKey } from './parts';
import type { MachinePose } from './pose';

/** A crude rose engine in three.js, in machine-frame mm: x toward the rubber
 *  and cutter, y up, z along the spindle toward the cutter. It exists to make
 *  a wrong motion obvious, so every part moves from the same pose the 2D
 *  views draw. */
export interface MachineScene {
  update(settings: Settings, pose: MachinePose, spindle: number, exaggerate: number): void;
  /** The part under a point given in the canvas's CSS pixels, or null. */
  pick(x: number, y: number): PartKey | null;
  /** Tints one part to show it is the one being explained. */
  highlight(part: PartKey | null): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const ROSETTE_Z = -40;

function rosetteGeometry(r: Rosette): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  for (let k = 0; k <= 360; k++) {
    const a = (k / 360) * TAU;
    const rr = radiusAt(r, a);
    if (k === 0) shape.moveTo(rr * Math.cos(a), rr * Math.sin(a));
    else shape.lineTo(rr * Math.cos(a), rr * Math.sin(a));
  }
  return new THREE.ExtrudeGeometry(shape, { depth: 4, bevelEnabled: false });
}

export function createMachineScene(canvas: HTMLCanvasElement): MachineScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101012');
  scene.add(new THREE.HemisphereLight('#ffffff', '#303036', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(80, 120, 160);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
  camera.position.set(110, 50, 170);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, -10, -20);
  controls.update();

  const metal = (color: string) => new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 });
  const steel = metal('#8d9096');
  const brass = metal('#c9a35a');

  const bed = new THREE.Mesh(new THREE.BoxGeometry(260, 10, 160), metal('#3a3a40'));
  scene.add(bed);
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 120, 24).rotateX(Math.PI / 2), steel);
  scene.add(pivot);

  // Everything that rocks hangs off the pivot; the pump slides it along z.
  const headstock = new THREE.Group();
  scene.add(headstock);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 70), steel);
  headstock.add(arm);
  const spindle = new THREE.Group();
  headstock.add(spindle);
  spindle.add(new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 90, 24).rotateX(Math.PI / 2).translate(0, 0, -30), steel));
  const rosette = new THREE.Mesh(rosetteGeometry({ radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1 } }), brass);
  rosette.position.z = ROSETTE_Z;
  spindle.add(rosette);
  const work = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 6, 64).rotateX(Math.PI / 2).translate(0, 0, -3), metal('#d8d6d0'));
  spindle.add(work);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.5), metal('#e5484d'));
  spindle.add(mark);

  const rubber = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8, 24).rotateX(Math.PI / 2), metal('#7fb3d5'));
  rubber.position.z = ROSETTE_Z + 2;
  scene.add(rubber);
  const cutter = new THREE.Mesh(new THREE.ConeGeometry(2.5, 14, 4).rotateX(-Math.PI / 2).translate(0, 0, 7), metal('#e8a33d'));
  scene.add(cutter);

  const parts = new Map<PartKey, THREE.Mesh[]>([
    ['bed', [bed]],
    ['pivot', [pivot]],
    ['headstock', [arm]],
    ['spindle', [spindle.children[0] as THREE.Mesh]],
    ['rosette', [rosette]],
    ['work', [work, mark]],
    ['rubber', [rubber]],
    ['cutter', [cutter]],
  ]);
  for (const [key, meshes] of parts) {
    for (const m of meshes) {
      m.userData.part = key;
      // Each mesh gets its own material so one part can glow alone.
      m.material = (m.material as THREE.MeshStandardMaterial).clone();
    }
  }
  const raycaster = new THREE.Raycaster();

  let shownRosette: Rosette | null = null;
  let frame = 0;
  const render = () => {
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };
  frame = requestAnimationFrame(render);

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
      work.scale.set(pose.stock, pose.stock, 1);
      mark.scale.set(pose.stock * 0.9, 1.2, 1);
      mark.position.set((pose.stock * 0.9) / 2, 0, 0.3);
      const reach = settings.rubber.shape === 'round' ? Math.max(settings.rubber.radius, 0.6) : settings.rubber.width / 2;
      rubber.scale.set(reach, reach, 1);
      rubber.position.set(pose.rubberX, 0, ROSETTE_Z + 2);
      cutter.position.set(pose.cutter[0], pose.cutter[1], 0);
    },
    pick(x, y) {
      const ndc = new THREE.Vector2((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects([...parts.values()].flat(), false)[0];
      return (hit?.object.userData.part as PartKey | undefined) ?? null;
    },
    highlight(part) {
      for (const [key, meshes] of parts) {
        for (const m of meshes) (m.material as THREE.MeshStandardMaterial).emissive.set(key === part ? '#3a2a10' : '#000000');
      }
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
    dispose() {
      cancelAnimationFrame(frame);
      controls.dispose();
      renderer.dispose();
    },
  };
}
