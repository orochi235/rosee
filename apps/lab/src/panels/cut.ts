import { f, resolveConfigSchema } from '@weasel-js/labkit';
import type { Settings } from 'rosee';
import type { Panel } from './panel';

/** What `Pass.at` measures, as the sidebar labels it: on each surface of a
 *  rose engine, and across the stroke of a straight-line engine. */
const MEASURES = { flat: 'radius', cylinder: 'along barrel', dome: 'arc from pole', straight: 'row' } as const;
type Measure = keyof typeof MEASURES;

const measureOf = (s: Settings): Measure => (s.engine.kind === 'straight' ? 'straight' : s.surface.kind);

/** One job field per measure, each labeled for it and shown only where it
 *  applies; all read and write the same job field. */
function positions(key: 'from' | 'to', label: string, def: number) {
  return Object.fromEntries(
    (Object.keys(MEASURES) as Measure[]).map((m) => [
      `${key}_${m}`,
      f
        .number(def)
        .range(m === 'straight' ? -100 : 0, 200)
        .step(0.05)
        .label(`${label} ${MEASURES[m]}`)
        .suffix('mm')
        .manual()
        .showIf((c) => c.measure === m),
    ]),
  );
}

export const cutPanel: Panel<Settings> = {
  title: 'Cutter and job',
  schema: resolveConfigSchema(
    f.schema({
      vAngle: f.number(110).range(30, 170).step(1).label('V angle').suffix('°').manual(),
      tipFlat: f.number(0).range(0, 0.2).step(0.005).label('Tip flat').suffix('mm').manual(),
      ...positions('from', 'From', 4),
      ...positions('to', 'To', 18),
      step: f.number(0.35).range(0.02, 5).step(0.01).label('Step').suffix('mm').manual(),
      depth: f.number(0.15).range(0.005, 1).step(0.005).label('Depth').suffix('mm').manual(),
      phaseStep: f.number(2).range(-180, 180).step(0.25).label('Phase step').suffix('°').manual(),
      phaseGroup: f.number(1).range(1, 20).step(1).label('Passes per phase').manual(),
      pumpPhaseStep: f.number(0).range(-180, 180).step(0.25).label('Pump phase step').suffix('°').manual(),
      indexCount: f.number(1).range(1, 24).step(1).label('Divisions').manual(),
      samplesPerTurn: f.number(2048).range(256, 8192).step(256).label('Samples per turn').manual(),
    }),
  ),
  read: (s) => {
    const { from, to, ...job } = s.job;
    const config: Record<string, unknown> = { ...s.cutter, ...job, samplesPerTurn: s.samplesPerTurn, measure: measureOf(s) };
    for (const kind of Object.keys(MEASURES)) {
      config[`from_${kind}`] = from;
      config[`to_${kind}`] = to;
    }
    return config;
  },
  write: (s, c) => ({
    ...s,
    cutter: { vAngle: c.vAngle as number, tipFlat: c.tipFlat as number },
    job: {
      ...s.job,
      from: c[`from_${measureOf(s)}`] as number,
      to: c[`to_${measureOf(s)}`] as number,
      step: c.step as number,
      depth: c.depth as number,
      phaseStep: c.phaseStep as number,
      phaseGroup: c.phaseGroup as number,
      pumpPhaseStep: c.pumpPhaseStep as number,
      indexCount: c.indexCount as number,
    },
    samplesPerTurn: c.samplesPerTurn as number,
  }),
};
