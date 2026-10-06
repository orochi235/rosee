import { turnFraction } from '../angle';
import { num, type ParamSpec } from '../params';
import { drawnLobe, flatLobe, type LobeProfile, petalLobe, type ProfilePoint, scallopLobe, sineLobe } from './profile';

/** A rosette's wave: `lobes` repeats of a lobe shape, `amplitude` mm from the
 *  mean radius to a peak. */
export type Wave =
  | { kind: 'sine'; lobes: number; amplitude: number }
  | { kind: 'flat'; lobes: number; amplitude: number; flat: number }
  | { kind: 'petal'; lobes: number; amplitude: number; sharpness: number }
  | { kind: 'scallop'; lobes: number; amplitude: number }
  | { kind: 'drawn'; lobes: number; amplitude: number; points: ProfilePoint[] }
  | { kind: 'compound'; waves: Wave[] };

export type WaveKind = Wave['kind'];

/** A rosette: a wave around a mean radius, both in mm. */
export interface Rosette {
  radius: number;
  wave: Wave;
}

type SimpleWave = Exclude<Wave, { kind: 'compound' }>;

const profiles = new WeakMap<SimpleWave, LobeProfile>();

/** The wave's lobe shape, built once per wave object. */
function lobeProfile(w: SimpleWave): LobeProfile {
  let p = profiles.get(w);
  if (!p) {
    p = buildProfile(w);
    profiles.set(w, p);
  }
  return p;
}

const buildProfile = (w: SimpleWave): LobeProfile => {
  switch (w.kind) {
    case 'sine':
      return sineLobe;
    case 'flat':
      return flatLobe(w.flat);
    case 'petal':
      return petalLobe(w.sharpness);
    case 'scallop':
      return scallopLobe;
    case 'drawn':
      return drawnLobe(w.points);
  }
};

/** Radial displacement of the wave from the mean radius at rosette-local
 *  angle `a` (radians), in mm. */
export function displacement(w: Wave, a: number): number {
  if (w.kind === 'compound') return w.waves.reduce((sum, c) => sum + displacement(c, a), 0);
  return w.amplitude * lobeProfile(w)(turnFraction(a * w.lobes));
}

/** Outline radius at rosette-local angle `a` (radians). */
export const radiusAt = (r: Rosette, a: number): number => r.radius + displacement(r.wave, a);

/** Params each simple wave kind exposes, as data for the lab's panels. */
export const WAVE_PARAMS: Record<Exclude<WaveKind, 'compound'>, ParamSpec[]> = {
  sine: [num('lobes', 'Lobes', 12, 1, 96, 1), num('amplitude', 'Amplitude', 1.5, 0, 10, 0.05, 'mm')],
  flat: [
    num('lobes', 'Lobes', 12, 1, 96, 1),
    num('amplitude', 'Amplitude', 1.5, 0, 10, 0.05, 'mm'),
    num('flat', 'Flat fraction', 0.4, 0, 0.9, 0.01),
  ],
  petal: [
    num('lobes', 'Lobes', 12, 1, 96, 1),
    num('amplitude', 'Amplitude', 1.5, 0, 10, 0.05, 'mm'),
    num('sharpness', 'Sharpness', 2, 1, 6, 0.1),
  ],
  scallop: [num('lobes', 'Lobes', 12, 1, 96, 1), num('amplitude', 'Amplitude', 1.5, 0, 10, 0.05, 'mm')],
  drawn: [num('lobes', 'Lobes', 12, 1, 96, 1), num('amplitude', 'Amplitude', 1.5, 0, 10, 0.05, 'mm')],
};
