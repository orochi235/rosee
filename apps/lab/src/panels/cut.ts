import { f, resolveConfigSchema } from '@weasel-js/labkit';
import type { Settings } from 'rosee';
import type { Panel } from './panel';

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
      ...s.job,
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
