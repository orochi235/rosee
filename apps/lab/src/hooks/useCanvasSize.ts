import { type RefObject, useEffect, useState } from 'react';

/** A canvas's CSS size and device pixel ratio, kept current; the canvas's
 *  backing store is resized to match. */
export function useCanvasSize(ref: RefObject<HTMLCanvasElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0, dpr: 1 });
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const apply = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      setSize({ width, height, dpr });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
