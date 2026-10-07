import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../palette';
import type { Head, Metal } from './head';
import { rosetteGeometry } from './rosetteGeometry';

const PLATE = 2;
const CARRIAGE = 4;
const RAIL = 2;
/** The pinion's teeth, and how far each stands off its pitch circle, mm. */
const TEETH = 12;
const TOOTH = 0.6;
/** The pinion's face, behind the carriage; the rosette plate is 4 mm thick. */
const PINION_Z = -PLATE - CARRIAGE - 8;

/** The rack, carriage-frame mm along y, `length` long: a bar the pinion's
 *  side of the carriage, with teeth half a pitch off the middle, which is
 *  where the pinion's valleys meet it. */
function rackGeometry(stroke: number, length: number): THREE.BufferGeometry {
  const pitch = stroke / TEETH;
  const r = stroke / (2 * Math.PI);
  const back = PLATE + CARRIAGE;
  const depth = -PINION_Z - back + 4;
  const bar = new THREE.BoxGeometry(1.5, length, depth).translate(r + TOOTH + 0.75, 0, -back - depth / 2);
  const teeth: THREE.BufferGeometry[] = [bar];
  for (let y = pitch / 2; y < length / 2; y += pitch)
    for (const s of [1, -1]) teeth.push(new THREE.BoxGeometry(2 * TOOTH, pitch / 2, 4).translate(r, s * y, PINION_Z + 2));
  return mergeGeometries(teeth.map((g) => g.toNonIndexed()))!;
}

/** A straight-line engine's work: a plate on the carriage's division plate,
 *  the carriage on rails along the rocking frame, driven from the arbor by a
 *  rack and pinion whose pitch circle rolls one stroke per turn. */
export function createStraightHead(spindle: THREE.Group, headstock: THREE.Group, metal: Metal): Head {
  const frame = new THREE.Group();
  headstock.add(frame);
  const unit = () => new THREE.BoxGeometry(1, 1, 1);
  const rails = [-1, 1].map(() => new THREE.Mesh(unit(), metal(PALETTE.steel)));
  frame.add(...rails);
  const slide = new THREE.Group();
  frame.add(slide);
  const carriage = new THREE.Mesh(unit(), metal(PALETTE.steel));
  slide.add(carriage);
  const rack = new THREE.Mesh(new THREE.BufferGeometry(), metal(PALETTE.rosette));
  slide.add(rack);
  const work = new THREE.Group();
  slide.add(work);
  const plate = new THREE.Mesh(unit(), metal(PALETTE.work));
  work.add(plate);
  const pinion = new THREE.Mesh(new THREE.BufferGeometry(), metal(PALETTE.rosette));
  pinion.position.z = PINION_Z;
  spindle.add(pinion);
  let shown = '';

  return {
    parts: [
      ['work', [plate]],
      ['carriage', [carriage, ...rails]],
      ['gearing', [rack, pinion]],
    ],
    work,
    show(on) {
      frame.visible = on;
      pinion.visible = on;
    },
    update(settings, pose) {
      const c = pose.carriage;
      if (!c || settings.engine.kind !== 'straight') return;
      const { stroke } = settings.engine;
      frame.position.set(0, settings.pivotDistance, 0);
      const { min, max } = c.plate;
      const key = JSON.stringify([stroke, c.railHalf]);
      if (key !== shown) {
        pinion.geometry.dispose();
        pinion.geometry = rosetteGeometry({ radius: stroke / (2 * Math.PI), wave: { kind: 'sine', lobes: TEETH, amplitude: TOOTH } });
        rack.geometry.dispose();
        rack.geometry = rackGeometry(stroke, 2 * (c.railX + 1));
        shown = key;
      }
      rails.forEach((rail, k) => {
        rail.scale.set(RAIL, 2 * c.railHalf, RAIL);
        rail.position.set((k ? 1 : -1) * c.railX, 0, -PLATE - CARRIAGE - RAIL / 2);
      });
      slide.position.set(0, c.travel, 0);
      carriage.scale.set(2 * (c.railX + 1), 2 * (c.railX + 1), CARRIAGE);
      carriage.position.set(0, 0, -PLATE - CARRIAGE / 2);
      work.rotation.z = pose.slideAngle;
      plate.scale.set(max[0] - min[0], max[1] - min[1], PLATE);
      plate.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, -PLATE / 2);
    },
  };
}
