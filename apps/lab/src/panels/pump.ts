import { f, resolveConfigSchema } from '@weasel-js/labkit';
import type { Settings } from 'rosee';
import { DEFAULT_PUMP, type SimpleWave } from '../defaults';
import type { Panel } from './panel';

export const pumpPanel: Panel<Settings> = {
  title: 'Pumping',
  schema: resolveConfigSchema(
    f.schema({
      on: f.boolean(false).label('Pump').manual(),
      lobes: f
        .number(6)
        .range(1, 48)
        .step(1)
        .label('Lobes')
        .manual()
        .showIf((c) => c.on === true),
      amplitude: f
        .number(0.02)
        .range(0, 0.2)
        .step(0.005)
        .label('Amplitude')
        .suffix('mm')
        .manual()
        .showIf((c) => c.on === true),
      gain: f
        .number(1)
        .range(0.1, 5)
        .step(0.1)
        .label('Lever ratio')
        .manual()
        .showIf((c) => c.on === true),
    }),
  ),
  read: (s) => {
    const w = (s.pump ?? DEFAULT_PUMP).rosette.wave;
    const d = DEFAULT_PUMP.rosette.wave as SimpleWave;
    return {
      on: s.pump !== null,
      lobes: 'lobes' in w ? w.lobes : d.lobes,
      amplitude: 'amplitude' in w ? w.amplitude : d.amplitude,
      gain: (s.pump ?? DEFAULT_PUMP).gain,
    };
  },
  write: (s, c) => ({
    ...s,
    pump: c.on
      ? {
          rosette: { ...DEFAULT_PUMP.rosette, wave: { kind: 'sine', lobes: c.lobes as number, amplitude: c.amplitude as number } },
          rubber: DEFAULT_PUMP.rubber,
          gain: c.gain as number,
        }
      : null,
  }),
};
