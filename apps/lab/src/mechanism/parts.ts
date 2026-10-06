import { deg, grooveWidth, type Settings, type Toolpaths } from 'rosee';
import type { PlayheadAt } from '../playhead';
import type { MachinePose } from './pose';

export type PartKey = 'rosette' | 'rubber' | 'headstock' | 'pivot' | 'spindle' | 'work' | 'cutter' | 'bed';

export interface PartText {
  title: string;
  what: string;
  how: string;
}

/** What each part is and how it works, for the hover callouts. */
export const PARTS: Record<PartKey, PartText> = {
  rosette: {
    title: 'Rosette',
    what: 'A cam on the spindle whose edge is a ring of lobes.',
    how: 'It turns with the work. Pressed against the rubber, each lobe pushes the whole headstock over, and that push is the pattern.',
  },
  rubber: {
    title: 'Rubber',
    what: 'The follower that rides the rosette, fixed to the bed.',
    how: 'It reads the rosette the way a stylus reads a record. Its shape decides what it can feel: a wide one bridges narrow valleys and never reaches their floor.',
  },
  headstock: {
    title: 'Headstock',
    what: 'The frame carrying the spindle, rosette and work together.',
    how: 'A spring holds the rosette against the rubber, so the headstock rocks on its pivot as the lobes pass, carrying the work sideways past the cutter.',
  },
  pivot: {
    title: 'Pivot',
    what: 'The axis the headstock rocks about, below the spindle.',
    how: 'The work moves on an arc around it, not a straight line. The shorter the arm, the more that arc bends the cut.',
  },
  spindle: {
    title: 'Spindle',
    what: 'The shaft that turns the rosette and the work as one.',
    how: 'One turn is one pass. Between passes the rosette can be phased against the work, or the work indexed round on the division plate.',
  },
  work: {
    title: 'Work',
    what: 'The stock being engraved, held on the spindle nose.',
    how: 'It turns under a cutter that never moves, so every motion of the cut comes from the work moving, not the tool.',
  },
  cutter: {
    title: 'Cutter',
    what: 'A V graver held still on the slide rest.',
    how: 'It cuts a groove as wide as its V at that depth. Its V stays square to the machine, so a groove narrows where the path climbs steeply.',
  },
  bed: {
    title: 'Bed',
    what: 'The fixed frame of the machine.',
    how: 'The rubber and slide rest are fixed to it; everything that moves is measured against it.',
  },
};

export interface LiveContext {
  settings: Settings;
  toolpaths: Toolpaths;
  at: PlayheadAt;
  pose: MachinePose;
  exaggerate: number;
}

const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);

/** One line read from the simulation at the playhead, or '' for parts with
 *  nothing changing. */
export function liveLine(part: PartKey, c: LiveContext): string {
  const { settings: s, toolpaths: t, at, pose } = c;
  const pass = t.passes[at.pass];
  const i = at.sample;
  switch (part) {
    case 'rosette': {
      const w = s.rosette.wave;
      const shape = w.kind === 'compound' ? 'compound' : `${w.lobes}-lobe ${w.kind}`;
      return `${shape} · phase ${f1(pass.pass.phase)}°`;
    }
    case 'rubber': {
      const r = s.rubber;
      const shape = r.shape === 'round' ? (r.radius === 0 ? 'knife edge' : `round, ${f2(r.radius)} mm`) : `flat, ${f1(r.width)} mm`;
      return `${shape} · touching at ${f1(deg(pass.contact[i]))}°${pose.steep ? ' · steep: jumps here' : ''}`;
    }
    case 'headstock':
      return `swing ${f2(pose.swing * 1000)} mrad (shown ×${c.exaggerate} in 3D)`;
    case 'pivot':
      return `${f1(s.pivotDistance)} mm below the spindle`;
    case 'spindle':
      return `${f1(at.degrees)}° into ${at.label}`;
    case 'work': {
      const r = Math.hypot(pass.xyz[i * 3], pass.xyz[i * 3 + 1]);
      return `cutting at radius ${f2(r)} mm`;
    }
    case 'cutter': {
      const depth = -pass.xyz[i * 3 + 2];
      return `${s.cutter.vAngle}° V · ${f2(depth)} mm deep · groove ${f2(grooveWidth(s.cutter, depth))} mm wide`;
    }
    case 'bed':
      return '';
  }
}
