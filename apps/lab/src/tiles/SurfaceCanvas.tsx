import type { Cutter, Toolpaths } from 'rosee';
import { type Carve, carveMesh, createCarve, createPart, createShade, METALS, type Orbit, type Part, type Shade, type View } from 'rosee/gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasSize } from '../hooks/useCanvasSize';
import { linear, PALETTE } from '../palette';
import type { PlayheadAt } from '../playhead';
import type { Look } from '../state';

interface Props {
  toolpaths: Toolpaths;
  cutter: Cutter;
  upTo: PlayheadAt;
  view: View;
  /** The camera round the part, used in the Part mode. */
  orbit: Orbit;
  look: Look;
  /** Kept mounted while hidden, so toggling the output mode reuses one
   *  WebGL context instead of leaking a new one each time. */
  hidden: boolean;
}

const BACKGROUND = linear(PALETTE.background);

/** The carved, lit surface, flat on its sheet or wrapped into the part.
 *  Re-meshes when the cut changes, re-carves when
 *  the playhead moves, and re-lights on anything else; does none of it while
 *  hidden. A lost context is rebuilt when the browser restores it. */
export function SurfaceCanvas({ toolpaths, cutter, upTo, view, orbit, look, hidden }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(ref);
  const gl = useRef<{ carve: Carve; shade: Shade; part: Part } | null>(null);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  const mesh = useMemo(() => carveMesh(toolpaths, cutter), [toolpaths, cutter]);

  useEffect(() => {
    const canvas = ref.current!;
    const context = canvas.getContext('webgl2');
    if (!context) {
      setError('This browser has no WebGL2, so the surface cannot be drawn.');
      return;
    }
    let lost = false;
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      gl.current = null;
    };
    const onRestored = () => setGeneration((g) => g + 1);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    let made: { carve: Carve; shade: Shade; part: Part } | null = null;
    try {
      made = { carve: createCarve(context, look.resolution), shade: createShade(context), part: createPart(context) };
      gl.current = made;
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (made && !lost) {
        made.carve.dispose();
        made.shade.dispose();
        made.part.dispose();
      }
      gl.current = null;
    };
  }, [look.resolution, generation]);

  useEffect(() => gl.current?.carve.load(mesh), [mesh, look.resolution, generation]);
  useEffect(() => {
    if (!hidden) gl.current?.carve.carve(upTo);
  }, [mesh, upTo.pass, upTo.sample, look.resolution, generation, hidden]);
  useEffect(() => {
    const g = gl.current;
    if (!g || hidden || size.width === 0) return;
    const light = { azimuth: look.azimuth, elevation: look.elevation };
    if (look.mode === 'part') g.part.render(g.carve, toolpaths.surface, orbit, light, METALS[look.metal], BACKGROUND);
    else g.shade.render(g.carve, { center: view.center, mmPerPixel: view.mmPerPixel / size.dpr }, light, METALS[look.metal], BACKGROUND);
  });

  return (
    <div className={`rs-pane${hidden ? ' rs-hidden' : ''}`}>
      <canvas ref={ref} className="rs-canvas" />
      {error && <p className="rs-error rs-pane-error">{error}</p>}
    </div>
  );
}
