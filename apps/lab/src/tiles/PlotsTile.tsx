import { Plot2D } from '@weasel-js/ui';
import type { Toolpaths } from 'rosee';
import { useRef } from 'react';
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
export function PlotsTile({ toolpaths, at }: { toolpaths: Toolpaths; at: PlayheadAt }) {
  const body = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(body);
  const pass = Math.min(at.pass, toolpaths.passes.length - 1);
  const rowHeight = Math.max(40, (height - SERIES.length * 18) / SERIES.length);
  const cursor = (at.sample / toolpaths.samples) * 360;
  return (
    <div className="rs-plots" ref={body}>
      {width > 0 &&
        SERIES.map((s) => {
          const values = s.values(toolpaths, pass);
          const yRange = range(values);
          const toX = (deg: number) => (deg / 360) * width;
          const toY = (v: number) => rowHeight - ((v - yRange[0]) / (yRange[1] - yRange[0])) * rowHeight;
          const points = Array.from(values, (v, i) => `${toX((i / toolpaths.samples) * 360)},${toY(v)}`).join(' ');
          return (
            <figure key={s.label} className="rs-plot">
              <figcaption>
                {s.label} <span className="rs-unit">{s.unit}</span>
              </figcaption>
              <Plot2D width={width} height={rowHeight} xRange={[0, 360]} yRange={yRange} axes={false} yTicks={{}}>
                <polyline points={points} className="rs-plot-line" />
                <line x1={toX(cursor)} x2={toX(cursor)} y1={0} y2={rowHeight} className="rs-plot-cursor" />
              </Plot2D>
            </figure>
          );
        })}
    </div>
  );
}
