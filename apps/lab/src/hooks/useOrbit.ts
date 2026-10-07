import { DEFAULT_ORBIT, type Orbit } from 'rosee/gl';
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState, type WheelEvent } from 'react';

const isReset = (e: globalThis.KeyboardEvent) => e.key === '0' && !e.metaKey && !e.ctrlKey && !e.altKey;

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** A camera turning round the part: drag to turn it, wheel to zoom, 0 to
 *  reset, as the flat views pan and zoom. */
export function useOrbit() {
  const [orbit, setOrbit] = useState<Orbit>(DEFAULT_ORBIT);
  const drag = useRef<{ id: number; x: number; y: number; from: Orbit } | null>(null);
  const hovered = useRef(false);
  const release = () => {
    drag.current = null;
  };

  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (hovered.current && isReset(e) && !isTyping(e.target)) setOrbit(DEFAULT_ORBIT);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const handlers = {
    onWheel: (e: WheelEvent<HTMLElement>) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      setOrbit((o) => ({ ...o, zoom: Math.min(40, Math.max(0.3, o.zoom * factor)) }));
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: orbit };
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const yaw = d.from.yaw - (e.clientX - d.x) * 0.4;
      const pitch = Math.min(89, Math.max(-89, d.from.pitch + (e.clientY - d.y) * 0.4));
      setOrbit((o) => ({ ...o, yaw, pitch }));
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
      setOrbit(DEFAULT_ORBIT);
    },
    tabIndex: 0,
    'aria-keyshortcuts': '0',
  };
  return { orbit, handlers };
}
