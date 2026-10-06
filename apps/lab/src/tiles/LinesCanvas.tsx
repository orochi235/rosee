import type { Toolpaths } from 'rosee';
import type { View } from 'rosee/gl';
import { useEffect, useRef } from 'react';
import { useCanvasSize } from '../hooks/useCanvasSize';
import type { PlayheadAt } from '../playhead';
import { PALETTE } from '../palette';
import { drawLines } from './drawLines';

export function LinesCanvas({
  toolpaths,
  upTo,
  view,
  background = PALETTE.background,
}: {
  toolpaths: Toolpaths;
  upTo: PlayheadAt;
  view: View;
  /** Null draws the lines over nothing. */
  background?: string | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(ref);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx && size.width > 0) drawLines(ctx, toolpaths, upTo, view, size, { ...PALETTE, background });
  });
  return <canvas ref={ref} className="rs-canvas" />;
}
