import type { Cutter, Toolpaths } from 'rosee';
import { useRef } from 'react';
import { useElementSize } from '../hooks/useElementSize';
import { useView } from '../hooks/useView';
import type { Look } from '../state';
import type { PlayheadAt } from '../playhead';
import { fitExtent } from './fit';
import { LinesCanvas } from './LinesCanvas';
import { SurfaceCanvas } from './SurfaceCanvas';

interface Props {
  toolpaths: Toolpaths;
  cutter: Cutter;
  upTo: PlayheadAt;
  look: Look;
}

/** The pattern as lines, as the lit surface, or both side by side, sharing
 *  one pan and zoom. Drag to pan, wheel to zoom, double-click to reset. */
export function OutputTile({ toolpaths, cutter, upTo, look }: Props) {
  const body = useRef<HTMLDivElement>(null);
  const size = useElementSize(body);
  const pane = look.mode === 'split' ? { ...size, width: size.width / 2 } : size;
  const { view, handlers } = useView(fitExtent(toolpaths), pane);
  return (
    <div className={`rs-output rs-output-${look.mode}`} ref={body} {...handlers}>
      {look.mode !== 'surface' && <LinesCanvas toolpaths={toolpaths} upTo={upTo} view={view} />}
      {look.mode !== 'lines' && <SurfaceCanvas toolpaths={toolpaths} cutter={cutter} upTo={upTo} view={view} look={look} />}
    </div>
  );
}
