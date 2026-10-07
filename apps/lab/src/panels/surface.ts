import { f, resolveConfigSchema } from '@weasel-js/labkit';
import type { Settings, Surface } from 'rosee';
import { DEFAULT_SURFACES } from '../defaults';
import type { Panel } from './panel';

const curved = (c: Record<string, unknown>) => c.kind !== 'flat';

export const surfacePanel: Panel<Settings> = {
  title: 'Surface',
  schema: resolveConfigSchema(
    f.schema({
      kind: f
        .enum<string>('flat', ['flat', 'cylinder', 'dome'])
        .label('Surface')
        .describe('A flat face, a barrel cut round its side, or a dome cut with the graver kept square to it.')
        .manual(),
      radius: f.number(10).range(1, 100).step(0.5).label('Radius').suffix('mm').manual().showIf(curved),
      length: f
        .number(24)
        .range(1, 200)
        .step(0.5)
        .label('Length')
        .suffix('mm')
        .manual()
        .showIf((c) => c.kind === 'cylinder'),
      rim: f
        .number(20)
        .range(1, 100)
        .step(0.5)
        .label('Rim radius')
        .suffix('mm')
        .describe('How far from the axis the dome is cut out to; at most its radius, a hemisphere.')
        .manual()
        .showIf((c) => c.kind === 'dome'),
    }),
  ),
  read: (s) => {
    const sf = s.surface;
    return {
      kind: sf.kind,
      radius: sf.kind === 'flat' ? DEFAULT_SURFACES.cylinder.radius : sf.radius,
      length: sf.kind === 'cylinder' ? sf.length : DEFAULT_SURFACES.cylinder.length,
      rim: sf.kind === 'dome' ? sf.rim : DEFAULT_SURFACES.dome.rim,
    };
  },
  write: (s, c) => {
    const kind = c.kind as Surface['kind'];
    const from = s.surface.kind;
    let surface: Surface;
    if (kind === 'flat') surface = DEFAULT_SURFACES.flat;
    else if (from === 'flat') surface = DEFAULT_SURFACES[kind];
    else if (kind === 'cylinder') surface = { kind, radius: c.radius as number, length: c.length as number };
    else surface = { kind, radius: c.radius as number, rim: Math.min(c.rim as number, c.radius as number) };
    return { ...s, surface };
  },
};
