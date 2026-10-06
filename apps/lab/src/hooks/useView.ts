import { type PointerEvent, useCallback, useRef, useState, type WheelEvent } from 'react';

/** A pan and zoom over the work, in mm: the point at the canvas's center and
 *  how much a CSS pixel spans. `fit` is the half-width to show at zoom 1. */
export function useView(fit: number, size: { width: number; height: number }) {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  const drag = useRef<{ x: number; y: number; center: [number, number] } | null>(null);
  const fitPerPixel = (2 * fit) / Math.max(1, Math.min(size.width, size.height));
  const mmPerPixel = fitPerPixel / zoom;

  const onWheel = useCallback(
    (e: WheelEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left - rect.width / 2;
      const py = rect.height / 2 - (e.clientY - rect.top);
      const next = Math.min(200, Math.max(0.5, zoom * Math.exp(-e.deltaY * 0.0015)));
      const before = fitPerPixel / zoom;
      const after = fitPerPixel / next;
      // Keep the point under the cursor where it is.
      setCenter(([cx, cy]) => [cx + px * (before - after), cy + py * (before - after)]);
      setZoom(next);
    },
    [zoom, fitPerPixel],
  );

  const handlers = {
    onWheel,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, center };
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      setCenter([d.center[0] - (e.clientX - d.x) * mmPerPixel, d.center[1] + (e.clientY - d.y) * mmPerPixel]);
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onDoubleClick: () => {
      setZoom(1);
      setCenter([0, 0]);
    },
  };

  return { view: { center, mmPerPixel }, handlers };
}
