import { f, resolveConfigSchema } from '@weasel-js/labkit';
import { METALS } from 'rosee/gl';
import { DEFAULT_LOOK as D, type Look, OUTPUT_MODES, RESOLUTIONS } from '../state';
import type { Panel } from './panel';

export const lookPanel: Panel<Look> = {
  title: 'Look',
  schema: resolveConfigSchema(
    f.schema({
      mode: f.enum<string>(D.mode, [...OUTPUT_MODES]).label('Output').manual(),
      metal: f.enum<string>(D.metal, Object.keys(METALS)).label('Metal').manual(),
      azimuth: f.number(D.azimuth).range(-180, 180).step(1).label('Light azimuth').suffix('°').manual(),
      elevation: f.number(D.elevation).range(2, 90).step(1).label('Light elevation').suffix('°').manual(),
      resolution: f.enum<string>(String(D.resolution), RESOLUTIONS.map(String)).label('Carve resolution').manual(),
      exaggerate: f
        .number(D.exaggerate)
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
