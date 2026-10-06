import type { Settings, Toolpaths } from 'rosee';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Callout, type Hover, PartsList } from '../Callout';
import { useCanvasSize } from '../hooks/useCanvasSize';
import { drawSide } from '../mechanism/drawSide';
import { drawTop, type Frame, type Palette } from '../mechanism/drawTop';
import type { PartKey } from '../mechanism/parts';
import { pickTop } from '../mechanism/pickTop';
import { type MachinePose, machinePose } from '../mechanism/pose';
import type { PlayheadAt } from '../playhead';

const TABS = ['Top', 'Side', 'Contact'] as const;
type Tab = (typeof TABS)[number];

const PALETTE: Palette = {
  background: '#101012',
  ink: '#c8c4bb',
  faint: '#3a3a40',
  rosette: '#c9a35a',
  rubber: '#7fb3d5',
  contact: '#e8e2d0',
  steep: '#e5484d',
  cutter: '#e8a33d',
  stock: 'rgba(200, 200, 210, 0.12)',
};

const rubberReach = (s: Settings) => (s.rubber.shape === 'round' ? s.rubber.radius : s.rubber.width / 2);

/** Frames the rosette and rubber together. */
function topFrame(s: Settings, pose: MachinePose, size: { width: number; height: number }): Frame {
  const left = -s.rosette.radius - 4;
  const right = pose.rubberX + rubberReach(s) + 4;
  const half = s.rosette.radius + 6;
  return {
    center: [(left + right) / 2, 0],
    scale: Math.min(size.width / (right - left), size.height / (2 * half)),
  };
}

/** Close on the contact, at true scale. */
function contactFrame(s: Settings, pose: MachinePose, size: { width: number; height: number }): Frame {
  const half = Math.max(rubberReach(s) * 3, 2) + 2 * ('amplitude' in s.rosette.wave ? s.rosette.wave.amplitude : 1);
  return { center: pose.contact, scale: Math.min(size.width, size.height) / (2 * half) };
}

export function MechanismTile({
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
  const [tab, setTab] = useState<Tab>('Top');
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(ref);
  const [hover, setHover] = useState<Hover | null>(null);
  const pose = useMemo(() => machinePose(settings, toolpaths, at), [settings, toolpaths, at]);
  const frame = tab === 'Side' ? null : tab === 'Top' ? topFrame(settings, pose, size) : contactFrame(settings, pose, size);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx || size.width === 0) return;
    if (frame) drawTop(ctx, pose, settings.rubber, frame, size, PALETTE);
    else drawSide(ctx, pose, settings.pump !== null, exaggerate, size, PALETTE);
  });
  const show = (part: PartKey | null, x: number, y: number) => setHover(part ? { part, x, y } : null);
  return (
    <div className="rs-tile-body rs-stage">
      <div className="rs-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <canvas
        ref={ref}
        className="rs-canvas"
        onPointerMove={(e) => {
          if (!frame) return;
          const r = e.currentTarget.getBoundingClientRect();
          show(pickTop(pose, settings.rubber, frame, size, [e.clientX - r.left, e.clientY - r.top]), e.clientX, e.clientY);
        }}
        onPointerLeave={() => setHover(null)}
      />
      {frame && <PartsList parts={['rosette', 'rubber', 'headstock', 'spindle', 'work', 'cutter']} onShow={show} />}
      {hover && frame && (
        <Callout hover={hover} live={{ settings, toolpaths, at, pose, exaggerate }} />
      )}
    </div>
  );
}
