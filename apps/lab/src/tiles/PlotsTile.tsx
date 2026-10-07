import { Plot2D } from '@weasel-js/ui';
import type { Surface, Toolpaths } from 'rosee';
import { useMemo, useRef } from 'react';
import { useElementSize } from '../hooks/useElementSize';
import type { PlayheadAt } from '../playhead';

interface Series {
  label: string;
  unit: string;
  values: (t: Toolpaths, pass: number) => Float32Array;
}

const SERIES: Series[] = [
  { label: 'Swing', unit: 'mrad', values: (t, k) => t.passes[k].swing.map((v) => v * 1000) },
  { label: 'Pump travel', unit: 'µm', values: (t, k) => t.passes[k].pump.map((v) => v * 1000) },
];

/** A value read from each sample's place on the sheet. */
const onSheet = (f: (u: number, v: number, h: number) => number) => (t: Toolpaths, k: number) => {
  const uvh = t.passes[k].uvh;
  return Float32Array.from({ length: uvh.length / 3 }, (_, i) => f(uvh[i * 3], uvh[i * 3 + 1], uvh[i * 3 + 2]));
};

/** Where the cutter is on the work, as the surface measures it; and on a
 *  curved one, where rocking moves the work into the cutter, how deep. */
const PLACE: Record<Surface['kind'], Series[]> = {
  flat: [{ label: 'Cutter radius on the work', unit: 'mm', values: onSheet((u, v) => Math.hypot(u, v)) }],
  cylinder: [
    { label: 'Cutter along the barrel', unit: 'mm', values: onSheet((_, v) => v) },
    { label: 'Depth of cut', unit: 'mm', values: onSheet((_, __, h) => -h) },
  ],
  dome: [
    { label: 'Cutter arc from the pole', unit: 'mm', values: onSheet((u, v) => Math.hypot(u, v)) },
    { label: 'Depth of cut', unit: 'mm', values: onSheet((_, __, h) => -h) },
  ],
};

/** On a straight-line engine, where the cutter sits across the stroke. */
const ACROSS: Series = {
  label: 'Cutter across the stroke',
  unit: 'mm',
  // The work is turned on the carriage by the index; turn it back.
  values: (t, k) => {
    const a = (t.passes[k].pass.index * Math.PI) / 180;
    return onSheet((u, v) => u * Math.cos(a) + v * Math.sin(a))(t, k);
  },
};

const SLIDE: Series = { label: 'Chuck slide', unit: 'mm', values: (t, k) => t.passes[k].slide };
const CARRIAGE: Series = { ...SLIDE, label: 'Carriage' };

function range(v: Float32Array): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of v) {
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  const pad = Math.max((hi - lo) * 0.1, 1e-3);
  return [lo - pad, hi + pad];
}

/** Each motion against spindle angle for the current pass, cursor at the
 *  playhead. `slide` names the work's slide, if it has one. */
export function PlotsTile({ toolpaths, at, slide }: { toolpaths: Toolpaths; at: PlayheadAt; slide: 'chuck' | 'carriage' | null }) {
  const kind = toolpaths.surface.kind;
  const body = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(body);
  const shown = useMemo(
    () => [
      ...SERIES,
      ...(slide === 'carriage' ? [ACROSS] : PLACE[kind]),
      ...(slide === 'chuck' ? [SLIDE] : slide === 'carriage' ? [CARRIAGE] : []),
    ],
    [slide, kind],
  );
  const rowHeight = Math.max(40, (height - shown.length * 18) / shown.length);
  const series = useMemo(
    () =>
      shown.map((s) => {
        const values = s.values(toolpaths, at.pass);
        return { ...s, values, yRange: range(values) };
      }),
    [toolpaths, at.pass, shown],
  );
  const lines = useMemo(
    () =>
      series.map(({ values, yRange }) =>
        Array.from(values, (v, i) => {
          const x = (i / toolpaths.samples) * width;
          const y = rowHeight - ((v - yRange[0]) / (yRange[1] - yRange[0])) * rowHeight;
          return `${x},${y}`;
        }).join(' '),
      ),
    [series, toolpaths.samples, width, rowHeight],
  );
  const cursor = (at.degrees / 360) * width;
  return (
    <div className="rs-plots" ref={body}>
      {width > 0 &&
        series.map((s, k) => (
          <figure key={s.label} className="rs-plot">
            <figcaption>
              {s.label} <span className="rs-unit">{s.unit}</span>
            </figcaption>
            <Plot2D width={width} height={rowHeight} xRange={[0, 360]} yRange={s.yRange} axes={false} yTicks={{}}>
              <polyline points={lines[k]} className="rs-plot-line" />
              <line x1={cursor} x2={cursor} y1={0} y2={rowHeight} className="rs-plot-cursor" />
            </Plot2D>
          </figure>
        ))}
    </div>
  );
}
