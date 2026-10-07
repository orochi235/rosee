import { machineToHeadstock, type Surface } from 'rosee';
import * as THREE from 'three';
import { PALETTE } from '../palette';
import type { Head, Metal } from './head';

/** How far behind a face or a dome's rim the stock runs back into the chuck, mm. */
const STOCK_BACK = 6;

/** The stock as a solid in work-frame mm, its face or pole at z = 0. */
function stockGeometry(surface: Surface, stock: number): THREE.BufferGeometry {
  switch (surface.kind) {
    case 'flat':
      return new THREE.CylinderGeometry(stock, stock, STOCK_BACK, 96).rotateX(Math.PI / 2).translate(0, 0, -STOCK_BACK / 2);
    case 'cylinder':
      return new THREE.CylinderGeometry(surface.radius, surface.radius, surface.length, 96)
        .rotateX(Math.PI / 2)
        .translate(0, 0, -surface.length / 2);
    case 'dome': {
      const S = surface.radius;
      const top = Math.asin(Math.min(1, surface.rim / S));
      // A lathe profile in (radius, height), the height then turned onto z.
      const profile: THREE.Vector2[] = [];
      for (let k = 0; k <= 48; k++) {
        const g = (k / 48) * top;
        profile.push(new THREE.Vector2(S * Math.sin(g), -S + S * Math.cos(g)));
      }
      const rimZ = -S + S * Math.cos(top);
      profile.push(new THREE.Vector2(surface.rim, rimZ - STOCK_BACK), new THREE.Vector2(0, rimZ - STOCK_BACK));
      return new THREE.LatheGeometry(profile, 96).rotateX(Math.PI / 2);
    }
  }
}

/** A rose engine's work: round stock on the spindle nose, on a chuck's slide
 *  when one is fitted, with the elliptical chuck's ring on the headstock. */
export function createRoseHead(spindle: THREE.Group, headstock: THREE.Group, metal: Metal): Head {
  const work = new THREE.Mesh(stockGeometry({ kind: 'flat' }, 1), metal(PALETTE.work));
  // Two-sided, so a dome's lathe profile shows whichever way it winds.
  (work.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
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
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 12, 96), metal(PALETTE.steel));
  headstock.add(ring);
  let shownStock = '';

  return {
    parts: [
      ['work', [work, mark]],
      ['chuck', [slide]],
      ['ring', [ring]],
    ],
    work: carrier,
    show(on) {
      chuck.visible = on;
      if (!on) ring.visible = false;
    },
    update(settings, pose, spindleAngle) {
      const P = settings.pivotDistance;
      const ch = pose.chuck;
      chuck.rotation.z = pose.slideAngle - spindleAngle;
      slide.visible = ch !== null;
      // Longer than the work is wide, and the ring wider, so both show past it.
      slide.scale.x = 2.6 * pose.stock;
      carrier.position.set(pose.carrier[0], pose.carrier[1], 0);
      carrier.rotation.z = ch?.wheel ?? 0;
      ring.visible = ch?.ring != null;
      if (ch?.ring) {
        const [hx, hy] = machineToHeadstock(ch.ring, P, pose.swing);
        ring.position.set(hx, hy + P, -11);
        ring.scale.setScalar(ch.ringRadius);
      }
      const stockKey = JSON.stringify([settings.surface, pose.stock]);
      if (stockKey !== shownStock) {
        work.geometry.dispose();
        work.geometry = stockGeometry(settings.surface, pose.stock);
        shownStock = stockKey;
      }
      // The mark shows the work turning; a dome's face is curved, so it has none.
      mark.visible = settings.surface.kind !== 'dome';
      mark.scale.set(pose.stock * 0.9, 1.2, 1);
      mark.position.set((pose.stock * 0.9) / 2, 0, 0.3);
    },
  };
}
