import { f, resolveConfigSchema } from '@weasel-js/labkit';
import type { Rubber, Settings } from 'rosee';
import { RUBBERS } from '../defaults';
import type { Panel } from './panel';

const rubberRead = (r: Rubber) => ({
  shape: r.shape,
  radius: r.shape === 'round' ? r.radius : RUBBERS.round.radius,
  width: r.shape === 'flat' ? r.width : RUBBERS.flat.width,
});

const rubberWrite = (c: Record<string, unknown>): Rubber =>
  c.shape === 'flat' ? { shape: 'flat', width: c.width as number } : { shape: 'round', radius: c.radius as number };

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
      pivotDistance: f
        .number(150)
        .range(20, 600)
        .step(5)
        .label('Pivot below spindle')
        .suffix('mm')
        .describe('How far below the spindle axis the headstock rocks. Shorter arms bend the cut along an arc.')
        .manual(),
    }),
  ),
  read: (s) => ({ ...rubberRead(s.rubber), pivotDistance: s.pivotDistance }),
  write: (s, c) => ({ ...s, rubber: rubberWrite(c), pivotDistance: c.pivotDistance as number }),
};
