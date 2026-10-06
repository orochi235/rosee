import type { Cutter, Toolpaths } from 'rosee';
import { useRef } from 'react';
import { PALETTE } from '../palette';
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
  /** Behind the lines; null leaves them on nothing. */
  background?: string | null;
}

/** The pattern as lines, as the lit surface, or both side by side, sharing
 *  one pan and zoom. Drag to pan, wheel to zoom, 0 to reset. */
export function OutputTile({ toolpaths, cutter, upTo, look, background = PALETTE.background }: Props) {
  const body = useRef<HTMLDivElement>(null);
  const size = useElementSize(body);
  const pane = look.mode === 'split' ? { ...size, width: size.width / 2 } : size;
  const { view, handlers } = useView(fitExtent(toolpaths), pane);
  // The surface is kept mounted once shown, but a view that has only ever
  // drawn lines never pays for its WebGL context.
  const surfaceShown = useRef(false);
  surfaceShown.current ||= look.mode !== 'lines';
  return (
    <div className={`rs-output rs-output-${look.mode}`} ref={body} {...handlers}>
      {look.mode !== 'surface' && <LinesCanvas toolpaths={toolpaths} upTo={upTo} view={view} background={background} />}
      {surfaceShown.current && (
        <SurfaceCanvas toolpaths={toolpaths} cutter={cutter} upTo={upTo} view={view} look={look} hidden={look.mode === 'lines'} />
      )}
    </div>
  );
}
