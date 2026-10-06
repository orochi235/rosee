import type { Cutter, Toolpaths } from 'rosee';
import { type Carve, carveMesh, createCarve, createShade, METALS, type Shade, type View } from 'rosee/gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasSize } from '../hooks/useCanvasSize';
import type { Look } from '../state';
import type { PlayheadAt } from '../playhead';

interface Props {
  toolpaths: Toolpaths;
  cutter: Cutter;
  upTo: PlayheadAt;
  view: View;
  look: Look;
}

const BACKGROUND: [number, number, number] = [0.06, 0.06, 0.07];

/** The carved, lit surface. Re-meshes when the cut changes, re-carves when
 *  the playhead moves, and re-lights on anything else. */
export function SurfaceCanvas({ toolpaths, cutter, upTo, view, look }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(ref);
  const gl = useRef<{ carve: Carve; shade: Shade } | null>(null);
  const [error, setError] = useState('');
  const mesh = useMemo(() => carveMesh(toolpaths, cutter), [toolpaths, cutter]);

  useEffect(() => {
    const context = ref.current?.getContext('webgl2');
    if (!context) {
      setError('This browser has no WebGL2, so the surface cannot be drawn.');
      return;
    }
    const carve = createCarve(context, look.resolution);
    const shade = createShade(context);
    gl.current = { carve, shade };
    return () => {
      carve.dispose();
      shade.dispose();
      gl.current = null;
    };
  }, [look.resolution]);

  useEffect(() => gl.current?.carve.load(mesh), [mesh, look.resolution]);
  useEffect(() => gl.current?.carve.carve(upTo), [mesh, upTo.pass, upTo.sample, look.resolution]);
  useEffect(() => {
    const g = gl.current;
    if (!g || size.width === 0) return;
    g.shade.render(
      g.carve,
      { center: view.center, mmPerPixel: view.mmPerPixel / size.dpr },
      { azimuth: look.azimuth, elevation: look.elevation },
      METALS[look.metal],
      BACKGROUND,
    );
  });

  return error ? <p className="rs-error">{error}</p> : <canvas ref={ref} className="rs-canvas" />;
}
