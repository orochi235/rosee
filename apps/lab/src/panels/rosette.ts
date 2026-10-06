import { f, resolveConfigSchema } from '@weasel-js/labkit';
import { type Rosette, type Settings, WAVE_PARAMS } from 'rosee';
import { defaultWave, SIMPLE_KINDS as KINDS, type SimpleKind, type SimpleWave } from '../defaults';
import { num, type Panel } from './panel';

/** Every kind's params in one schema, each shown only for the kinds that have it. */
function waveFields() {
  const fields: Record<string, ReturnType<typeof num>> = {};
  const kindsOf = new Map<string, SimpleKind[]>();
  for (const kind of KINDS) {
    for (const p of WAVE_PARAMS[kind]) {
      if (p.type !== 'number') continue;
      kindsOf.set(p.key, [...(kindsOf.get(p.key) ?? []), kind]);
      fields[p.key] ??= num(p);
    }
  }
  for (const [key, kinds] of kindsOf) {
    if (kinds.length < KINDS.length) fields[key] = fields[key].showIf((c) => kinds.includes(c.kind as SimpleKind));
  }
  return fields;
}

function rosetteRead(r: Rosette): Record<string, unknown> {
  const w = r.wave.kind === 'compound' ? r.wave.waves[0] : r.wave;
  return { radius: r.radius, ...(w as Record<string, unknown>) };
}

function rosetteWrite(r: Rosette, c: Record<string, unknown>): Rosette {
  const base = defaultWave(c.kind as SimpleKind);
  // Each param the panel holds a value of the right type for; the kind's default otherwise.
  const wave = Object.fromEntries(
    Object.entries(base).map(([k, v]) => [k, k !== 'kind' && typeof c[k] === typeof v ? c[k] : v]),
  ) as SimpleWave;
  return { radius: typeof c.radius === 'number' ? c.radius : r.radius, wave };
}

export const rosettePanel: Panel<Settings> = {
  title: 'Rosette',
  schema: resolveConfigSchema(
    f.schema({
      kind: f.enum<string>('sine', KINDS).label('Shape').manual(),
      radius: f.number(30).range(5, 80).step(0.5).label('Mean radius').suffix('mm').manual(),
      ...waveFields(),
    }),
  ),
  read: (s) => rosetteRead(s.rosette),
  write: (s, c) => ({ ...s, rosette: rosetteWrite(s.rosette, c) }),
};
