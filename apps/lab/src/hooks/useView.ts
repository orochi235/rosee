import type { Fit } from '../tiles/fit';
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState, type WheelEvent } from 'react';

interface Zoomed {
  zoom: number;
  /** How far the view is panned from the fit's center, mm. */
  pan: [number, number];
}

const HOME: Zoomed = { zoom: 1, pan: [0, 0] };

/** The direct child of `container` holding `target`: the pane the pointer is
 *  over when the container shows several side by side. */
function paneUnder(container: HTMLElement, target: EventTarget): Element {
  for (const child of container.children) if (child.contains(target as Node)) return child;
  return container;
}

const isReset = (e: globalThis.KeyboardEvent) => e.key === '0' && !e.metaKey && !e.ctrlKey && !e.altKey;

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** A pan and zoom over the sheet, in mm: the point at each pane's center and
 *  how much a CSS pixel spans. `fit` is what to show at zoom 1, and `size`
 *  one pane's size. */
export function useView(fit: Fit, size: { width: number; height: number }) {
  const [state, setState] = useState<Zoomed>(HOME);
  const drag = useRef<{ id: number; x: number; y: number; pan: [number, number] } | null>(null);
  const fitPerPixel = Math.max((2 * fit.half[0]) / Math.max(1, size.width), (2 * fit.half[1]) / Math.max(1, size.height));
  const mmPerPixel = fitPerPixel / state.zoom;
  const release = () => {
    drag.current = null;
  };
  const hovered = useRef(false);

  // 0 resets the view while the pointer is over it, as Mod+0 resets a lab's
  // zoom; with the view focused instead, its own key handler does.
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (hovered.current && isReset(e) && !isTyping(e.target)) setState(HOME);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const handlers = {
    onWheel: (e: WheelEvent<HTMLElement>) => {
      const rect = paneUnder(e.currentTarget, e.target).getBoundingClientRect();
      const px = e.clientX - rect.left - rect.width / 2;
      const py = rect.height / 2 - (e.clientY - rect.top);
      const factor = Math.exp(-e.deltaY * 0.0015);
      setState(({ zoom, pan: [cx, cy] }) => {
        const next = Math.min(200, Math.max(0.5, zoom * factor));
        // Keep the point under the cursor where it is.
        const d = fitPerPixel / zoom - fitPerPixel / next;
        return { zoom: next, pan: [cx + px * d, cy + py * d] };
      });
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: state.pan };
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const pan: [number, number] = [d.pan[0] - (e.clientX - d.x) * mmPerPixel, d.pan[1] + (e.clientY - d.y) * mmPerPixel];
      setState((s) => ({ ...s, pan }));
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
    onPointerEnter: () => {
      hovered.current = true;
    },
    onPointerLeave: () => {
      hovered.current = false;
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (!isReset(e.nativeEvent) || hovered.current) return;
      e.preventDefault();
      setState(HOME);
    },
    tabIndex: 0,
    'aria-keyshortcuts': '0',
  };

  const center: [number, number] = [fit.center[0] + state.pan[0], fit.center[1] + state.pan[1]];
  return { view: { center, mmPerPixel }, handlers };
}
