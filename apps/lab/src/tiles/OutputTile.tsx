import type { Cutter, Toolpaths } from 'rosee';
import { useMemo, useRef } from 'react';
import { PALETTE } from '../palette';
import { useElementSize } from '../hooks/useElementSize';
import { useView } from '../hooks/useView';
import type { Look } from '../state';
import type { PlayheadAt } from '../playhead';
import { useOrbit } from '../hooks/useOrbit';
import { fitSheet } from './fit';
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

/** The pattern on its sheet as lines, as the lit surface, or both side by
 *  side, sharing one pan and zoom; or the carved part in 3D. Drag to pan or
 *  turn, wheel to zoom, 0 to reset. */
export function OutputTile({ toolpaths, cutter, upTo, look, background = PALETTE.background }: Props) {
  const body = useRef<HTMLDivElement>(null);
  const size = useElementSize(body);
  const pane = look.mode === 'split' ? { ...size, width: size.width / 2 } : size;
  const fit = useMemo(() => fitSheet(toolpaths), [toolpaths]);
  const { view, handlers: flat } = useView(fit, pane);
  const { orbit, handlers: turn } = useOrbit();
  const handlers = look.mode === 'part' ? turn : flat;
  // The surface is kept mounted once shown, but a view that has only ever
  // drawn lines never pays for its WebGL context.
  const surfaceShown = useRef(false);
  surfaceShown.current ||= look.mode !== 'lines';
  return (
    <div className={`rs-output rs-output-${look.mode}`} ref={body} {...handlers}>
      {(look.mode === 'lines' || look.mode === 'split') && <LinesCanvas toolpaths={toolpaths} upTo={upTo} view={view} background={background} />}
      {surfaceShown.current && (
        <SurfaceCanvas
          toolpaths={toolpaths}
          cutter={cutter}
          upTo={upTo}
          view={view}
          orbit={orbit}
          look={look}
          hidden={look.mode === 'lines'}
        />
      )}
    </div>
  );
}
