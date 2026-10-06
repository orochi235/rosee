import type { Toolpaths } from 'rosee';
import type { View } from 'rosee/gl';
import { useEffect, useRef } from 'react';
import { useCanvasSize } from '../hooks/useCanvasSize';
import type { PlayheadAt } from '../playhead';
import { drawLines } from './drawLines';

const COLORS = { line: '#d9d4c7', cutter: '#e8a33d', background: '#101012' };

export function LinesCanvas({ toolpaths, upTo, view }: { toolpaths: Toolpaths; upTo: PlayheadAt; view: View }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(ref);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx && size.width > 0) drawLines(ctx, toolpaths, upTo, view, size, COLORS);
  });
  return <canvas ref={ref} className="rs-canvas" />;
}
