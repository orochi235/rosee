import { f, resolveConfigSchema } from '@weasel-js/labkit';
import type { Engine, Settings } from 'rosee';
import { DEFAULT_ENGINES, DEFAULT_SURFACES } from '../defaults';
import type { Panel } from './panel';

const ROSE_FROM = 4;

export const enginePanel: Panel<Settings> = {
  title: 'Engine',
  schema: resolveConfigSchema(
    f.schema({
      kind: f
        .enum<string>('rose', ['rose', 'straight'])
        .label('Engine')
        .describe('A rose engine turns the work with the rosette. A straight-line engine slides it on a carriage geared to the rosette, cutting rows.')
        .manual(),
      stroke: f
        .number(30)
        .range(1, 200)
        .step(0.5)
        .label('Stroke')
        .suffix('mm')
        .describe('How far the carriage slides the work for each turn of the rosette.')
        .manual()
        .showIf((c) => c.kind === 'straight'),
    }),
  ),
  read: (s) => ({
    kind: s.engine.kind,
    stroke: s.engine.kind === 'straight' ? s.engine.stroke : DEFAULT_ENGINES.straight.stroke,
  }),
  write: (s, c) => {
    const kind = c.kind as Engine['kind'];
    const switched = kind !== s.engine.kind;
    const span = s.job.to - s.job.from;
    if (kind === 'rose') {
      // Rows across the stroke become radii, starting where a rose job does.
      const job = switched ? { ...s.job, from: ROSE_FROM, to: ROSE_FROM + Math.abs(span) } : s.job;
      return { ...s, engine: DEFAULT_ENGINES.rose, job };
    }
    // The carriage holds the work flat on it, with no chuck, and the rows sit
    // either side of the middle of the stroke.
    const rows = switched ? { from: -span / 2, to: span / 2 } : {};
    return {
      ...s,
      engine: { kind, stroke: c.stroke as number },
      chuck: null,
      surface: DEFAULT_SURFACES.flat,
      job: { ...s.job, ...rows, wheelCount: 1, eccentricityStep: 0 },
    };
  },
};
