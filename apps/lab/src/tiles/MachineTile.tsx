import type { Settings, Toolpaths } from 'rosee';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Callout, type Hover, PartsList } from '../Callout';
import { useElementSize } from '../hooks/useElementSize';
import { ALL_PARTS, partsFor } from '../mechanism/parts';
import { type CameraPlacement, CLOSE_UP, createMachineScene, type MachineScene } from '../mechanism/machine3d';
import type { MachinePose } from '../mechanism/pose';
import { cutPath, cutTo } from '../mechanism/trail';
import type { PlayheadAt } from '../playhead';

export function MachineTile({
  settings,
  toolpaths,
  at,
  pose,
  exaggerate,
  parts = true,
  camera = CLOSE_UP,
  transparent = false,
  inset = false,
}: {
  settings: Settings;
  toolpaths: Toolpaths;
  at: PlayheadAt;
  pose: MachinePose;
  exaggerate: number;
  /** The keyboard and touch list of parts, which the bare view leaves out. */
  parts?: boolean;
  /** Read once, when the scene is made. */
  camera?: CameraPlacement;
  /** No background behind the machine. Read once, like `camera`. */
  transparent?: boolean;
  /** A close-up of the graver in the corner. Read once, like `camera`. */
  inset?: boolean;
}) {
  const body = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<MachineScene | null>(null);
  const dragging = useRef(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const size = useElementSize(body);

  useEffect(() => {
    scene.current = createMachineScene(canvas.current!, camera, { transparent, inset });
    return () => scene.current?.dispose();
  }, []);
  useEffect(() => scene.current?.resize(size.width, size.height), [size.width, size.height]);
  useEffect(() => {
    scene.current?.update(settings, pose, at.angle, exaggerate);
  }, [settings, pose, at.angle, exaggerate]);
  const path = useMemo(() => cutPath(toolpaths), [toolpaths]);
  useEffect(() => scene.current?.path(path, toolpaths.samples), [path]);
  const end = cutTo(at, toolpaths.samples);
  useEffect(() => scene.current?.cut(end), [path, end]);
  useEffect(() => scene.current?.highlight(hover?.part ?? null), [hover?.part]);

  const show = (part: Hover['part'] | null, x: number, y: number) => setHover(part ? { part, x, y } : null);
  const release = () => {
    dragging.current = false;
  };
  return (
    <div className="rs-tile-body rs-stage" ref={body}>
      <canvas
        ref={canvas}
        className="rs-canvas"
        onPointerDown={() => {
          dragging.current = true;
          setHover(null);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onPointerMove={(e) => {
          if (dragging.current || !scene.current) return;
          const r = e.currentTarget.getBoundingClientRect();
          show(scene.current.pick(e.clientX - r.left, e.clientY - r.top), e.clientX, e.clientY);
        }}
        onPointerLeave={() => setHover(null)}
      />
      {parts && <PartsList parts={partsFor(settings, ALL_PARTS)} onShow={show} />}
      {hover && <Callout hover={hover} live={{ settings, toolpaths, at, pose, exaggerate }} />}
    </div>
  );
}
