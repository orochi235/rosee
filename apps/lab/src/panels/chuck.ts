import { f, resolveConfigSchema } from '@weasel-js/labkit';
import type { Chuck, Settings } from 'rosee';
import { DEFAULT_CHUCKS } from '../defaults';
import type { Panel } from './panel';

const fitted = (c: Record<string, unknown>) => c.kind !== 'none';

export const chuckPanel: Panel<Settings> = {
  title: 'Chuck',
  schema: resolveConfigSchema(
    f.schema({
      kind: f.enum<string>('none', ['none', 'eccentric', 'elliptical']).label('Chuck').manual(),
      eccentricity: f.number(8).range(0, 30).step(0.1).label('Eccentricity').suffix('mm').manual().showIf(fitted),
      ring: f
        .number(0)
        .range(-180, 180)
        .step(1)
        .label('Ring angle')
        .suffix('°')
        .describe('Which way the ring on the headstock is set off the spindle axis.')
        .manual()
        .showIf((c) => c.kind === 'elliptical'),
      wheel: f.number(0).range(-180, 180).step(0.5).label('Wheel').suffix('°').manual().showIf(fitted),
      wheelCount: f.number(1).range(1, 24).step(1).label('Wheel divisions').manual().showIf(fitted),
      eccentricityStep: f
        .number(0)
        .range(-2, 2)
        .step(0.05)
        .label('Eccentricity step')
        .suffix('mm')
        .describe('Added to the eccentricity every pass.')
        .manual()
        .showIf(fitted),
    }),
  ),
  read: (s) => {
    const c = s.chuck ?? DEFAULT_CHUCKS.eccentric;
    return {
      kind: s.chuck?.kind ?? 'none',
      eccentricity: c.eccentricity,
      ring: c.kind === 'elliptical' ? c.ring : DEFAULT_CHUCKS.elliptical.ring,
      wheel: c.wheel,
      wheelCount: s.job.wheelCount,
      eccentricityStep: s.job.eccentricityStep,
    };
  },
  write: (s, c) => {
    if (c.kind === 'none') return { ...s, chuck: null, job: { ...s.job, wheelCount: 1, eccentricityStep: 0 } };
    const kind = c.kind as Chuck['kind'];
    const chuck: Chuck =
      kind !== s.chuck?.kind
        ? DEFAULT_CHUCKS[kind]
        : kind === 'eccentric'
          ? { kind, eccentricity: c.eccentricity as number, wheel: c.wheel as number }
          : { kind, eccentricity: c.eccentricity as number, ring: c.ring as number, wheel: c.wheel as number };
    return { ...s, chuck, job: { ...s.job, wheelCount: c.wheelCount as number, eccentricityStep: c.eccentricityStep as number } };
  },
};
