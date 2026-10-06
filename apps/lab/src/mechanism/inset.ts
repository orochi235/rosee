import type { Vec2 } from 'rosee';
import * as THREE from 'three';

/** The graver and the half of the work around it, drawn over a corner of
 *  the main view, so the cut reads at a size the whole machine can't give it. */
export interface Inset {
  /** Where the graver's tip is, machine-frame mm, and the stock's radius. */
  aim(tip: Vec2, stock: number): void;
  /** Draws the inset into the bottom right of a `width` × `height` CSS px canvas. */
  render(width: number, height: number, beforeRender: (w: number, h: number) => void): void;
}

/** Fraction of the canvas's width the inset takes. */
const WIDTH = 0.38;
const ASPECT = 4 / 3;
const MARGIN = 12;
const BORDER = 1;
/** Off the spindle axis, so the graver reads as a solid and not a dot. */
const VIEW = new THREE.Vector3(0.35, 0.3, 1).normalize();

export function createInset(renderer: THREE.WebGLRenderer, scene: THREE.Scene, ground: string, edge: string): Inset {
  const camera = new THREE.PerspectiveCamera(30, ASPECT, 0.5, 2000);
  const target = new THREE.Vector3();
  const groundColor = new THREE.Color(ground);
  const edgeColor = new THREE.Color(edge);
  const saved = new THREE.Color();

  const fill = (x: number, y: number, w: number, h: number, color: THREE.Color) => {
    renderer.setScissor(x, y, w, h);
    renderer.setClearColor(color, 1);
    renderer.clear(true, true, false);
  };

  return {
    aim(tip, stock) {
      target.set(tip[0], tip[1], 0);
      // Far enough that the frame is one stock radius tall: about half the work.
      const distance = stock / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.copy(target).addScaledVector(VIEW, distance);
      camera.lookAt(target);
    },
    render(width, height, beforeRender) {
      const w = Math.round(width * WIDTH);
      const h = Math.round(w / ASPECT);
      const x = width - w - MARGIN;
      const y = MARGIN;
      const alpha = renderer.getClearAlpha();
      renderer.getClearColor(saved);
      renderer.setScissorTest(true);
      fill(x - BORDER, y - BORDER, w + 2 * BORDER, h + 2 * BORDER, edgeColor);
      fill(x, y, w, h, groundColor);
      renderer.setViewport(x, y, w, h);
      beforeRender(w, h);
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      renderer.setClearColor(saved, alpha);
    },
  };
}
