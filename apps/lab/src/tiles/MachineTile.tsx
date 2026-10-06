import { type Settings, TAU, type Toolpaths } from 'rosee';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Callout, type Hover, PartsList } from '../Callout';
import { useElementSize } from '../hooks/useElementSize';
import { createMachineScene, type MachineScene } from '../mechanism/machine3d';
import { machinePose } from '../mechanism/pose';
import type { PlayheadAt } from '../playhead';

export function MachineTile({
  settings,
  toolpaths,
  at,
  exaggerate,
}: {
  settings: Settings;
  toolpaths: Toolpaths;
  at: PlayheadAt;
  exaggerate: number;
}) {
  const body = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<MachineScene | null>(null);
  const dragging = useRef(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const size = useElementSize(body);
  const pose = useMemo(() => machinePose(settings, toolpaths, at), [settings, toolpaths, at]);

  useEffect(() => {
    scene.current = createMachineScene(canvas.current!);
    return () => scene.current?.dispose();
  }, []);
  useEffect(() => scene.current?.resize(size.width, size.height), [size.width, size.height]);
  useEffect(() => {
    scene.current?.update(settings, pose, (at.sample / toolpaths.samples) * TAU, exaggerate);
  });
  useEffect(() => scene.current?.highlight(hover?.part ?? null), [hover?.part]);

  const show = (part: Hover['part'] | null, x: number, y: number) => setHover(part ? { part, x, y } : null);
  return (
    <div className="rs-tile-body rs-stage" ref={body}>
      <canvas
        ref={canvas}
        className="rs-canvas"
        onPointerDown={() => {
          dragging.current = true;
          setHover(null);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerMove={(e) => {
          if (dragging.current || !scene.current) return;
          const r = e.currentTarget.getBoundingClientRect();
          show(scene.current.pick(e.clientX - r.left, e.clientY - r.top), e.clientX, e.clientY);
        }}
        onPointerLeave={() => setHover(null)}
      />
      <PartsList onShow={show} />
      {hover && <Callout hover={hover} live={{ settings, toolpaths, at, pose, exaggerate }} />}
    </div>
  );
}
