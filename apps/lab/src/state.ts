import { PRESETS, type PresetName, type Settings } from 'rosee';
import { METALS } from 'rosee/gl';

export const OUTPUT_MODES = ['lines', 'surface', 'split', 'part'] as const;
export type OutputMode = (typeof OUTPUT_MODES)[number];
export type MetalName = keyof typeof METALS;
/** Carve texture sizes the lab offers, texels on a side. */
export const RESOLUTIONS = [1024, 2048, 4096];

/** How the output is shown; none of it changes the cut. */
export interface Look {
  mode: OutputMode;
  azimuth: number;
  elevation: number;
  metal: MetalName;
  resolution: number;
  /** How many times the 3D machine magnifies swing, and the side view and
   *  the 3D machine magnify pump travel. */
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
  exaggerate: 1,
};

export const DEFAULT_STATE: LabState = { preset: 'swirl', settings: PRESETS.swirl, look: DEFAULT_LOOK };
