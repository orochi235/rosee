import { f, resolveConfigSchema } from '@weasel-js/labkit';
import { METALS } from 'rosee/gl';
import { type Look, OUTPUT_MODES, RESOLUTIONS } from '../state';
import type { Panel } from './panel';

export const lookPanel: Panel<Look> = {
  title: 'Look',
  schema: resolveConfigSchema(
    f.schema({
      mode: f.enum<string>('surface', [...OUTPUT_MODES]).label('Output').manual(),
      metal: f.enum<string>('silver', Object.keys(METALS)).label('Metal').manual(),
      azimuth: f.number(120).range(-180, 180).step(1).label('Light azimuth').suffix('°').manual(),
      elevation: f.number(35).range(2, 90).step(1).label('Light elevation').suffix('°').manual(),
      resolution: f.enum<string>('2048', RESOLUTIONS.map(String)).label('Carve resolution').manual(),
      exaggerate: f
        .number(1)
        .range(1, 100)
        .step(1)
        .label('Exaggerate motion')
        .describe('Magnifies the 3D machine’s swing, moving its rubber to stay on the rosette, and pump travel in the side view and the 3D machine; the top and contact views stay true.')
        .manual(),
    }),
  ),
  read: (l) => ({ ...l, resolution: String(l.resolution) }),
  write: (l, c) => ({ ...(c as unknown as Look), resolution: Number(c.resolution) }),
};
