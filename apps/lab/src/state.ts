import { PRESETS, type PresetName, type Settings } from 'rosee';
import { METALS } from 'rosee/gl';

export type OutputMode = 'lines' | 'surface' | 'split';
export type MetalName = keyof typeof METALS;

/** How the output is shown; none of it changes the cut. */
export interface Look {
  mode: OutputMode;
  azimuth: number;
  elevation: number;
  metal: MetalName;
  resolution: number;
  /** How many times the mechanism views magnify swing and pump travel. */
  exaggerate: number;
}

export interface LabState {
  /** The preset the settings came from, or '' once edited. */
  preset: PresetName | '';
  settings: Settings;
  look: Look;
}

export const DEFAULT_LOOK: Look = {
  mode: 'surface',
  azimuth: 120,
  elevation: 35,
  metal: 'silver',
  resolution: 2048,
  exaggerate: 10,
};

export function initialState(): LabState {
  return readHash() ?? { preset: 'swirl', settings: PRESETS.swirl, look: DEFAULT_LOOK };
}

const encode = (v: unknown): string =>
  btoa(String.fromCodePoint(...new TextEncoder().encode(JSON.stringify(v))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const decode = (s: string): unknown =>
  JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.codePointAt(0) ?? 0),
    ),
  );

/** The whole lab as a URL hash, so any state is a link. */
export function writeHash(s: LabState): void {
  history.replaceState(null, '', `#s=${encode(s)}`);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** A lab state from a hash someone may have edited by hand. Each part falls
 *  back to its default when it is missing; the settings are checked again,
 *  properly, by `computeToolpaths`, whose errors the lab shows. */
export function restore(raw: unknown): LabState | null {
  if (!isObject(raw) || !isObject(raw.settings)) return null;
  const s = raw.settings;
  if (!isObject(s.rosette) || !isObject(s.rubber) || !isObject(s.job) || !isObject(s.cutter)) return null;
  const preset = typeof raw.preset === 'string' && raw.preset in PRESETS ? (raw.preset as PresetName) : '';
  return {
    preset,
    settings: { ...PRESETS.swirl, ...(s as Partial<Settings>) },
    look: { ...DEFAULT_LOOK, ...(isObject(raw.look) ? (raw.look as Partial<Look>) : {}) },
  };
}

function readHash(): LabState | null {
  const m = location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    return restore(decode(m[1]));
  } catch {
    return null;
  }
}
