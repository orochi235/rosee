import { f, resolveConfigSchema } from '@weasel-js/labkit';
import type { Engine, Rubber, Settings } from 'rosee';
import { RUBBERS } from '../defaults';
import type { Panel } from './panel';

const rubberRead = (r: Rubber) => ({
  shape: r.shape,
  radius: r.shape === 'round' ? r.radius : RUBBERS.round.radius,
  width: r.shape === 'flat' ? r.width : RUBBERS.flat.width,
});

const rubberWrite = (c: Record<string, unknown>): Rubber =>
  c.shape === 'flat' ? { shape: 'flat', width: c.width as number } : { shape: 'round', radius: c.radius as number };

/** What the frame rocks below, as the sidebar names it on each engine. */
const AXES: Record<Engine['kind'], string> = { rose: 'spindle', straight: 'arbor' };

export const rubberPanel: Panel<Settings> = {
  title: 'Rubber and headstock',
  schema: resolveConfigSchema(
    f.schema({
      shape: f.enum<string>('round', ['round', 'flat']).label('Rubber').manual(),
      radius: f
        .number(1)
        .range(0, 10)
        .step(0.05)
        .label('Rubber radius')
        .suffix('mm')
        .describe('0 is a knife edge.')
        .manual()
        .showIf((c) => c.shape === 'round'),
      width: f
        .number(6)
        .range(0.5, 30)
        .step(0.5)
        .label('Face width')
        .suffix('mm')
        .manual()
        .showIf((c) => c.shape === 'flat'),
      ...Object.fromEntries(
        (Object.keys(AXES) as Engine['kind'][]).map((kind) => [
          `pivot_${kind}`,
          f
            .number(150)
            .range(20, 600)
            .step(5)
            .label(`Pivot below ${AXES[kind]}`)
            .suffix('mm')
            .describe(`How far below the ${AXES[kind]} the frame rocks. Shorter arms bend the cut along an arc.`)
            .manual()
            .showIf((c) => c.engine === kind),
        ]),
      ),
    }),
  ),
  read: (s) => ({
    ...rubberRead(s.rubber),
    engine: s.engine.kind,
    ...Object.fromEntries(Object.keys(AXES).map((kind) => [`pivot_${kind}`, s.pivotDistance])),
  }),
  write: (s, c) => ({ ...s, rubber: rubberWrite(c), pivotDistance: c[`pivot_${s.engine.kind}`] as number }),
};
