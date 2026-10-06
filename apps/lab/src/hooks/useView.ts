import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState, type WheelEvent } from 'react';

interface Zoomed {
  zoom: number;
  center: [number, number];
}

const HOME: Zoomed = { zoom: 1, center: [0, 0] };

/** The direct child of `container` holding `target`: the pane the pointer is
 *  over when the container shows several side by side. */
function paneUnder(container: HTMLElement, target: EventTarget): Element {
  for (const child of container.children) if (child.contains(target as Node)) return child;
  return container;
}

const isReset = (e: globalThis.KeyboardEvent) => e.key === '0' && !e.metaKey && !e.ctrlKey && !e.altKey;

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** A pan and zoom over the work, in mm: the point at each pane's center and
 *  how much a CSS pixel spans. `fit` is the half-width to show at zoom 1, and
 *  `size` one pane's size. */
export function useView(fit: number, size: { width: number; height: number }) {
  const [state, setState] = useState<Zoomed>(HOME);
  const drag = useRef<{ id: number; x: number; y: number; center: [number, number] } | null>(null);
  const fitPerPixel = (2 * fit) / Math.max(1, Math.min(size.width, size.height));
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
      setState(({ zoom, center: [cx, cy] }) => {
        const next = Math.min(200, Math.max(0.5, zoom * factor));
        // Keep the point under the cursor where it is.
        const d = fitPerPixel / zoom - fitPerPixel / next;
        return { zoom: next, center: [cx + px * d, cy + py * d] };
      });
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, center: state.center };
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const center: [number, number] = [d.center[0] - (e.clientX - d.x) * mmPerPixel, d.center[1] + (e.clientY - d.y) * mmPerPixel];
      setState((s) => ({ ...s, center }));
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

  return { view: { center: state.center, mmPerPixel }, handlers };
}
