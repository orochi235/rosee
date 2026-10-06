import { f, resolveConfigSchema, type ResolvedConfig } from '@weasel-js/labkit';
import type { ParamSpec, Rosette, Rubber, Settings, Wave } from 'rosee';
import { WAVE_PARAMS } from 'rosee';
import { METALS } from 'rosee/gl';
import type { Look } from './state';

/** One sidebar section: a labkit schema over a flat config, and the two
 *  mappings between that config and the lab state. */
export interface Panel<T> {
  title: string;
  schema: ResolvedConfig;
  read(from: T): Record<string, unknown>;
  write(to: T, config: Record<string, unknown>): T;
}

type Simple = Exclude<Wave, { kind: 'compound' }>;
type SimpleKind = Simple['kind'];
const KINDS: SimpleKind[] = ['sine', 'flat', 'petal', 'scallop', 'drawn'];

const num = (s: ParamSpec & { type: 'number' }) => {
  const node = f.number(s.default).range(s.min, s.max).step(s.step).label(s.label).manual();
  return s.suffix ? node.suffix(s.suffix) : node;
};

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

const DEFAULT_POINTS = [
  { u: 0, p: 1 },
  { u: 0.25, p: 0 },
  { u: 0.5, p: -1 },
  { u: 0.75, p: 0 },
];

function rosetteRead(r: Rosette): Record<string, unknown> {
  const w = r.wave.kind === 'compound' ? r.wave.waves[0] : r.wave;
  return { radius: r.radius, ...(w as Record<string, unknown>) };
}

function rosetteWrite(r: Rosette, c: Record<string, unknown>): Rosette {
  const kind = c.kind as SimpleKind;
  const lobes = c.lobes as number;
  const amplitude = c.amplitude as number;
  const points = r.wave.kind === 'drawn' ? r.wave.points : DEFAULT_POINTS;
  const waves: Record<SimpleKind, Simple> = {
    sine: { kind: 'sine', lobes, amplitude },
    flat: { kind: 'flat', lobes, amplitude, flat: (c.flat as number) ?? 0.4 },
    petal: { kind: 'petal', lobes, amplitude, sharpness: (c.sharpness as number) ?? 2 },
    scallop: { kind: 'scallop', lobes, amplitude },
    drawn: { kind: 'drawn', lobes, amplitude, points },
  };
  return { radius: c.radius as number, wave: waves[kind] };
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

const rubberRead = (r: Rubber) => ({
  shape: r.shape,
  radius: r.shape === 'round' ? r.radius : 1,
  width: r.shape === 'flat' ? r.width : 6,
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
    const w = s.pump?.rosette.wave;
    return {
      on: s.pump !== null,
      lobes: w && 'lobes' in w ? w.lobes : 6,
      amplitude: w && 'amplitude' in w ? w.amplitude : 0.02,
      gain: s.pump?.gain ?? 1,
    };
  },
  write: (s, c) => ({
    ...s,
    pump: c.on
      ? {
          rosette: { radius: 30, wave: { kind: 'sine', lobes: c.lobes as number, amplitude: c.amplitude as number } },
          rubber: { shape: 'round', radius: 0 },
          gain: c.gain as number,
        }
      : null,
  }),
};

export const cutPanel: Panel<Settings> = {
  title: 'Cutter and job',
  schema: resolveConfigSchema(
    f.schema({
      vAngle: f.number(110).range(30, 170).step(1).label('V angle').suffix('°').manual(),
      tipFlat: f.number(0).range(0, 0.2).step(0.005).label('Tip flat').suffix('mm').manual(),
      from: f.number(4).range(0, 60).step(0.05).label('From radius').suffix('mm').manual(),
      to: f.number(18).range(0, 60).step(0.05).label('To radius').suffix('mm').manual(),
      step: f.number(0.35).range(0.02, 5).step(0.01).label('Step').suffix('mm').manual(),
      depth: f.number(0.15).range(0.005, 1).step(0.005).label('Depth').suffix('mm').manual(),
      phaseStep: f.number(2).range(-180, 180).step(0.25).label('Phase step').suffix('°').manual(),
      phaseGroup: f.number(1).range(1, 20).step(1).label('Passes per phase').manual(),
      pumpPhaseStep: f.number(0).range(-180, 180).step(0.25).label('Pump phase step').suffix('°').manual(),
      indexCount: f.number(1).range(1, 24).step(1).label('Divisions').manual(),
      samplesPerTurn: f.number(2048).range(256, 8192).step(256).label('Samples per turn').manual(),
    }),
  ),
  read: (s) => ({ ...s.cutter, ...s.job, samplesPerTurn: s.samplesPerTurn }),
  write: (s, c) => ({
    ...s,
    cutter: { vAngle: c.vAngle as number, tipFlat: c.tipFlat as number },
    job: {
      from: c.from as number,
      to: c.to as number,
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

export const lookPanel: Panel<Look> = {
  title: 'Look',
  schema: resolveConfigSchema(
    f.schema({
      mode: f.enum<string>('surface', ['lines', 'surface', 'split']).label('Output').manual(),
      metal: f.enum<string>('silver', Object.keys(METALS)).label('Metal').manual(),
      azimuth: f.number(120).range(-180, 180).step(1).label('Light azimuth').suffix('°').manual(),
      elevation: f.number(35).range(2, 90).step(1).label('Light elevation').suffix('°').manual(),
      resolution: f.enum<string>('2048', ['1024', '2048', '4096']).label('Carve resolution').manual(),
      exaggerate: f
        .number(10)
        .range(1, 100)
        .step(1)
        .label('Exaggerate motion')
        .describe('Magnifies swing and pump travel in the mechanism views; the contact zoom stays true.')
        .manual(),
    }),
  ),
  read: (l) => ({ ...l, resolution: String(l.resolution) }),
  write: (l, c) => ({ ...(c as unknown as Look), resolution: Number(c.resolution) }),
};
