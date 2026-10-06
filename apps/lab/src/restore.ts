import { PRESETS, type PresetName, type Pump, type Rosette, type Rubber, type Settings, type Wave } from 'rosee';
import { METALS } from 'rosee/gl';
import { DEFAULT_PUMP, defaultWave, RUBBERS, SIMPLE_KINDS } from './defaults';
import { DEFAULT_STATE, type LabState, type Look, OUTPUT_MODES, RESOLUTIONS } from './state';

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const oneOf = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** `fallback` with each of its number fields taken from `raw` where `raw`
 *  holds a finite number there. */
function numbers<T extends object>(raw: unknown, fallback: T): T {
  const r = isObject(raw) ? raw : {};
  const out: Raw = { ...(fallback as Raw) };
  for (const [k, v] of Object.entries(fallback)) if (typeof v === 'number' && finite(r[k])) out[k] = r[k];
  return out as T;
}

function rubber(raw: unknown, fallback: Rubber): Rubber {
  if (!isObject(raw)) return fallback;
  const shape = oneOf(raw.shape, Object.keys(RUBBERS) as Rubber['shape'][], fallback.shape);
  return numbers(raw, shape === fallback.shape ? fallback : RUBBERS[shape]);
}

function points(raw: unknown) {
  if (!Array.isArray(raw)) return null;
  const valid = raw.filter((q) => isObject(q) && finite(q.u) && finite(q.p)).map((q) => ({ u: q.u as number, p: q.p as number }));
  return valid.length >= 2 ? valid : null;
}

function wave(raw: unknown, fallback: Wave): Wave {
  if (!isObject(raw)) return fallback;
  if (raw.kind === 'compound') {
    const fb = fallback.kind === 'compound' ? fallback.waves[0] : fallback;
    const waves = Array.isArray(raw.waves) ? raw.waves.map((w) => wave(w, fb)) : [];
    return waves.length > 0 ? { kind: 'compound', waves } : fallback;
  }
  const kind = oneOf(raw.kind, SIMPLE_KINDS, fallback.kind === 'compound' ? 'sine' : fallback.kind);
  const base = numbers(raw, fallback.kind === kind ? fallback : defaultWave(kind));
  return base.kind === 'drawn' ? { ...base, points: points(raw.points) ?? base.points } : base;
}

const rosette = (raw: unknown, fallback: Rosette): Rosette =>
  isObject(raw) ? { radius: finite(raw.radius) ? raw.radius : fallback.radius, wave: wave(raw.wave, fallback.wave) } : fallback;

function pump(raw: unknown, fallback: Pump | null): Pump | null {
  if (raw === null) return null;
  if (!isObject(raw)) return fallback;
  return {
    rosette: rosette(raw.rosette, DEFAULT_PUMP.rosette),
    rubber: rubber(raw.rubber, DEFAULT_PUMP.rubber),
    gain: finite(raw.gain) ? raw.gain : DEFAULT_PUMP.gain,
  };
}

function settings(raw: Raw): Settings {
  const d = DEFAULT_STATE.settings;
  return {
    rosette: rosette(raw.rosette, d.rosette),
    rubber: rubber(raw.rubber, d.rubber),
    pivotDistance: finite(raw.pivotDistance) ? raw.pivotDistance : d.pivotDistance,
    pump: pump(raw.pump, d.pump),
    cutter: numbers(raw.cutter, d.cutter),
    job: numbers(raw.job, d.job),
    samplesPerTurn: finite(raw.samplesPerTurn) ? raw.samplesPerTurn : d.samplesPerTurn,
  };
}

function look(raw: unknown): Look {
  const d = DEFAULT_STATE.look;
  const r = isObject(raw) ? raw : {};
  return {
    ...numbers(r, d),
    mode: oneOf(r.mode, OUTPUT_MODES, d.mode),
    metal: oneOf(r.metal, Object.keys(METALS) as Look['metal'][], d.metal),
    resolution: oneOf(r.resolution, RESOLUTIONS, d.resolution),
  };
}

/** A lab state from a hash someone may have edited by hand or saved from an
 *  older lab: every field the hash gets wrong or leaves out falls back to the
 *  default. Values of the right type but out of range are left for
 *  `computeToolpaths` to refuse, which the lab shows. */
export function restore(raw: unknown): LabState | null {
  if (!isObject(raw) || !isObject(raw.settings)) return null;
  const preset = typeof raw.preset === 'string' && Object.hasOwn(PRESETS, raw.preset) ? (raw.preset as PresetName) : '';
  return { preset, settings: settings(raw.settings), look: look(raw.look) };
}
