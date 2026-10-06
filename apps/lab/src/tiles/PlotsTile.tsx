import { Plot2D } from '@weasel-js/ui';
import type { Toolpaths } from 'rosee';
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
  {
    label: 'Cutter radius on the work',
    unit: 'mm',
    values: (t, k) => {
      const xyz = t.passes[k].xyz;
      return Float32Array.from({ length: xyz.length / 3 }, (_, i) => Math.hypot(xyz[i * 3], xyz[i * 3 + 1]));
    },
  },
];

const SLIDE: Series = { label: 'Chuck slide', unit: 'mm', values: (t, k) => t.passes[k].slide };

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

/** Each motion against spindle angle for the current pass, cursor at the playhead. */
export function PlotsTile({ toolpaths, at, chuck }: { toolpaths: Toolpaths; at: PlayheadAt; chuck: boolean }) {
  const body = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(body);
  const shown = useMemo(() => (chuck ? [...SERIES, SLIDE] : SERIES), [chuck]);
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
