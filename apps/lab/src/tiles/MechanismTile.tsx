import { rubberReach, type Settings, type Toolpaths } from 'rosee';
import { useEffect, useRef, useState } from 'react';
import { Callout, type Hover, PartsList } from '../Callout';
import { useCanvasSize } from '../hooks/useCanvasSize';
import { drawSide } from '../mechanism/drawSide';
import { drawTop, type Frame } from '../mechanism/drawTop';
import { type PartKey, partsFor } from '../mechanism/parts';
import { pickTop } from '../mechanism/pickTop';
import type { MachinePose } from '../mechanism/pose';
import { PALETTE } from '../palette';
import type { PlayheadAt } from '../playhead';
import { Tabs } from '../Tabs';

const TABS = ['Top', 'Side', 'Contact'] as const;
type Tab = (typeof TABS)[number];

/** Frames the rosette and rubber together. */
function topFrame(s: Settings, pose: MachinePose, size: { width: number; height: number }): Frame {
  const left = -s.rosette.radius - 4;
  const right = pose.rubberX + rubberReach(s.rubber) + 4;
  const half = s.rosette.radius + 6;
  return {
    center: [(left + right) / 2, 0],
    scale: Math.min(size.width / (right - left), size.height / (2 * half)),
  };
}

/** Close on the contact, at true scale. */
function contactFrame(s: Settings, pose: MachinePose, size: { width: number; height: number }): Frame {
  const half = Math.max(rubberReach(s.rubber) * 3, 2) + 2 * ('amplitude' in s.rosette.wave ? s.rosette.wave.amplitude : 1);
  return { center: pose.contact, scale: Math.min(size.width, size.height) / (2 * half) };
}

export function MechanismTile({
  settings,
  toolpaths,
  at,
  pose,
  exaggerate,
}: {
  settings: Settings;
  toolpaths: Toolpaths;
  at: PlayheadAt;
  pose: MachinePose;
  exaggerate: number;
}) {
  const [tab, setTab] = useState<Tab>('Top');
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(ref);
  const [hover, setHover] = useState<Hover | null>(null);
  const frame = tab === 'Side' ? null : tab === 'Top' ? topFrame(settings, pose, size) : contactFrame(settings, pose, size);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx || size.width === 0) return;
    if (frame) drawTop(ctx, pose, settings.rubber, frame, size, PALETTE);
    else drawSide(ctx, pose, settings.surface, settings.pump !== null, exaggerate, size, PALETTE);
  });
  const show = (part: PartKey | null, x: number, y: number) => setHover(part ? { part, x, y } : null);
  return (
    <div className="rs-tile-body rs-stage">
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
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
      {frame && <PartsList parts={partsFor(settings, ['rosette', 'rubber', 'headstock', 'spindle', 'work', 'cutter'])} settings={settings} onShow={show} />}
      {hover && frame && (
        <Callout hover={hover} live={{ settings, toolpaths, at, pose, exaggerate }} />
      )}
    </div>
  );
}
