import { type Chuck, type ProfilePoint, type Pump, type Rubber, type Surface, WAVE_PARAMS, type Wave } from 'rosee';

export type SimpleWave = Exclude<Wave, { kind: 'compound' }>;
export type SimpleKind = SimpleWave['kind'];

/** The wave kinds the sidebar edits, in its order. */
export const SIMPLE_KINDS: SimpleKind[] = ['sine', 'flat', 'petal', 'scallop', 'drawn'];

/** The lobe a newly drawn rosette starts from. */
export const DEFAULT_POINTS: ProfilePoint[] = [
  { u: 0, p: 1 },
  { u: 0.25, p: 0 },
  { u: 0.5, p: -1 },
  { u: 0.75, p: 0 },
];

/** A wave of `kind` with every param at its default. */
export function defaultWave(kind: SimpleKind): SimpleWave {
  const params = Object.fromEntries(WAVE_PARAMS[kind].map((p) => [p.key, p.default]));
  return (kind === 'drawn' ? { ...params, kind, points: DEFAULT_POINTS } : { ...params, kind }) as SimpleWave;
}

/** Each rubber shape as it starts when switched to. */
export const RUBBERS: { [S in Rubber['shape']]: Extract<Rubber, { shape: S }> } = {
  round: { shape: 'round', radius: 1 },
  flat: { shape: 'flat', width: 6 },
};

/** The pumping rosette the sidebar turns on. */
export const DEFAULT_PUMP: Pump = {
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 6, amplitude: 0.02 } },
  rubber: { shape: 'round', radius: 0 },
  gain: 1,
};

/** Each chuck as it starts when fitted. */
export const DEFAULT_CHUCKS: { [K in Chuck['kind']]: Extract<Chuck, { kind: K }> } = {
  eccentric: { kind: 'eccentric', eccentricity: 8, wheel: 0 },
  elliptical: { kind: 'elliptical', eccentricity: 4, ring: 0, wheel: 0 },
};

/** Each surface as it starts when chosen. */
export const DEFAULT_SURFACES: { [K in Surface['kind']]: Extract<Surface, { kind: K }> } = {
  flat: { kind: 'flat' },
  cylinder: { kind: 'cylinder', radius: 10, length: 24 },
  dome: { kind: 'dome', radius: 30, rim: 20 },
};
