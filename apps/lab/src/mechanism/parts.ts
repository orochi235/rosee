import { deg, grooveWidth, type Settings, type Toolpaths } from 'rosee';
import type { PlayheadAt } from '../playhead';
import type { MachinePose } from './pose';

export type PartKey =
  | 'rosette'
  | 'rubber'
  | 'headstock'
  | 'pivot'
  | 'spindle'
  | 'work'
  | 'cutter'
  | 'bed'
  | 'chuck'
  | 'ring'
  | 'carriage'
  | 'gearing';

/** Every part, in the order the parts lists show them. */
export const ALL_PARTS: PartKey[] = ['rosette', 'rubber', 'headstock', 'pivot', 'spindle', 'work', 'cutter', 'bed', 'chuck', 'ring', 'carriage', 'gearing'];

const FITTED: PartKey[] = ['chuck', 'ring', 'carriage', 'gearing'];

/** `base` with only the parts this machine has: the chuck's if one is
 *  fitted, and on a straight-line engine the carriage and, where `base` asks
 *  for it, its gearing. */
export function partsFor(s: Settings, base: PartKey[]): PartKey[] {
  const fitted: PartKey[] = base.filter((p) => !FITTED.includes(p));
  if (s.chuck) fitted.push('chuck');
  if (s.chuck?.kind === 'elliptical') fitted.push('ring');
  if (s.engine.kind === 'straight') {
    fitted.push('carriage');
    if (base.includes('gearing')) fitted.push('gearing');
  }
  return fitted;
}

export interface PartText {
  title: string;
  what: string;
  how: string;
}

/** What a part is and how it works on this machine, for the hover callouts. */
export const partText = (part: PartKey, s: Settings): PartText =>
  (s.engine.kind === 'straight' && STRAIGHT[part]) || PARTS[part];

/** What each part is and how it works on a rose engine, for the hover
 *  callouts; the parts only a straight-line engine has are here too. */
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
    what: 'The stock being engraved, held on the spindle nose: a face, a barrel or a dome.',
    how: 'It turns under a cutter that never moves, so every motion of the cut comes from the work moving, not the tool. On a barrel the rocking only moves it into and out of the cutter, so the pattern along it comes from pumping.',
  },
  cutter: {
    title: 'Cutter',
    what: 'A V graver held still on the slide rest, square to the surface.',
    how: 'It cuts a groove as wide as its V at that depth. Its V stays square to the machine, so a groove narrows where the path climbs steeply.',
  },
  chuck: {
    title: 'Chuck',
    what: 'A slide on the spindle nose that holds the work off the spindle axis.',
    how: 'An eccentric chuck sets the work off center and leaves it there, so the pattern lands off center; its wheel turns the work to repeat it around. An elliptical chuck slides the work there and back every turn, so every circle the cutter would cut becomes an ellipse.',
  },
  ring: {
    title: 'Ring',
    what: 'The elliptical chuck’s ring, bolted to the headstock off the spindle axis.',
    how: 'Blocks on the slide ride the ring, so as the spindle turns the slide is pushed out and back by the ring’s offset. The ring angle sets which way the ellipse lies.',
  },
  bed: {
    title: 'Bed',
    what: 'The fixed frame of the machine.',
    how: 'The rubber and slide rest are fixed to it; everything that moves is measured against it.',
  },
  carriage: {
    title: 'Carriage',
    what: 'A slide running on rails along the rocking frame, holding the work.',
    how: 'Geared to the arbor, it travels one stroke for every turn of the rosette, so how far along the row the cutter has got depends only on how far the rosette has turned.',
  },
  gearing: {
    title: 'Rack and pinion',
    what: 'A pinion on the arbor meshed with a rack on the carriage.',
    how: 'The pinion’s pitch circle is the stroke divided by 2π, so one turn of the arbor rolls the carriage exactly one stroke.',
  },
};

/** Where a straight-line engine's part differs from the rose engine's. */
const STRAIGHT: Partial<Record<PartKey, PartText>> = {
  rosette: {
    title: 'Rosette',
    what: 'A cam on the arbor whose edge is a ring of lobes.',
    how: 'It turns with the arbor. Pressed against the rubber, each lobe pushes the frame over, carrying the work across the cutter, and that push is the wave in each row.',
  },
  headstock: {
    title: 'Headstock',
    what: 'The rocking frame carrying the arbor, rosette, rails and carriage together.',
    how: 'A spring holds the rosette against the rubber, so the frame rocks on its pivot as the lobes pass, moving the work across the cutter while the carriage slides it along.',
  },
  pivot: {
    title: 'Pivot',
    what: 'The axis the frame rocks about, below the arbor.',
    how: 'The work moves on an arc around it, not a straight line. The shorter the arm, the more that arc bends the rows.',
  },
  spindle: {
    title: 'Arbor',
    what: 'The shaft that turns the rosette and, through the rack and pinion, drives the carriage.',
    how: 'One turn is one row. Between rows the rosette can be phased against the carriage, which shifts the waves along the row.',
  },
  work: {
    title: 'Work',
    what: 'A flat plate held on the carriage’s division plate.',
    how: 'It never turns while cutting: the carriage slides it past a cutter that never moves, and the rocking moves it across. Between sweeps the division plate can turn it, so a second division crosses the rows.',
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
      return `swing ${f2(pose.swing * 1000)} mrad (shown ×${c.exaggerate} in 3D, where the rubber moves to keep up)`;
    case 'pivot':
      return `${f1(s.pivotDistance)} mm below the ${s.engine.kind === 'straight' ? 'arbor' : 'spindle'}`;
    case 'spindle':
      return `${f1(at.degrees)}° into ${at.label}`;
    case 'work': {
      const [u, v] = [pass.uvh[i * 3], pass.uvh[i * 3 + 1]];
      if (s.engine.kind === 'straight') return `cutting the row at ${f2(pass.pass.at)} mm · turned ${f1(pass.pass.index)}° on the division plate`;
      switch (s.surface.kind) {
        case 'flat':
          return `cutting at radius ${f2(Math.hypot(u, v))} mm`;
        case 'cylinder':
          return `barrel ${f1(s.surface.radius * 2)} mm across · cutting ${f2(v)} mm from the face, ${f1(deg(u / s.surface.radius))}° round`;
        case 'dome':
          return `dome of ${f1(s.surface.radius)} mm radius · cutting ${f2(Math.hypot(u, v))} mm round from the pole`;
      }
    }
    case 'cutter': {
      const depth = -pass.uvh[i * 3 + 2];
      return `${s.cutter.vAngle}° V · ${f2(depth)} mm deep · groove ${f2(grooveWidth(s.cutter, depth))} mm wide`;
    }
    case 'chuck': {
      const ch = s.chuck;
      if (!ch || !pose.chuck) return '';
      const wheel = `wheel ${f1(deg(pose.chuck.wheel))}°`;
      const e = ch.eccentricity + pass.pass.eccentricity;
      return ch.kind === 'eccentric'
        ? `eccentric · ${f2(e)} mm off center · ${wheel}`
        : `elliptical · slide ${f2(pose.chuck.slide)} of ±${f2(e)} mm · ${wheel}`;
    }
    case 'ring':
      return s.chuck?.kind === 'elliptical'
        ? `${f2(s.chuck.eccentricity + pass.pass.eccentricity)} mm off the spindle toward ${f1(s.chuck.ring)}°`
        : '';
    case 'bed':
      return '';
    case 'carriage':
      return s.engine.kind === 'straight' ? `${f2(pass.slide[i])} of ±${f1(s.engine.stroke / 2)} mm along the stroke` : '';
    case 'gearing':
      return s.engine.kind === 'straight'
        ? `pitch radius ${f2(s.engine.stroke / (2 * Math.PI))} mm · ${f1(s.engine.stroke)} mm per turn`
        : '';
  }
}
