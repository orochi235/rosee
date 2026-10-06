/** One turn of the spindle with the cutter at one setting. Angles in
 *  degrees: `phase` turns the rosette against the work, `pumpPhase` the
 *  pumping rosette, `index` the work on the division plate. */
export interface Pass {
  radius: number;
  depth: number;
  phase: number;
  pumpPhase: number;
  index: number;
}

/** A program of passes, as the lab edits it: the cutter steps from radius
 *  `from` to `to` by `step` mm; every `phaseGroup` passes the rosette is
 *  phased on by `phaseStep`°, the pump by `pumpPhaseStep`° every pass; and
 *  the whole sweep repeats at `indexCount` even divisions of the work. */
export interface Job {
  from: number;
  to: number;
  step: number;
  depth: number;
  phaseStep: number;
  phaseGroup: number;
  pumpPhaseStep: number;
  indexCount: number;
}

/** How many passes the job expands to, without expanding it. */
export function passCount(job: Job): number {
  if (job.to !== job.from && !(job.step > 0)) throw new Error(`job step must be positive, got ${job.step}`);
  if (!(job.phaseGroup >= 1)) throw new Error(`job phaseGroup must be at least 1, got ${job.phaseGroup}`);
  if (!(Number.isInteger(job.indexCount) && job.indexCount >= 1))
    throw new Error(`job indexCount must be a whole number at least 1, got ${job.indexCount}`);
  return job.indexCount * sweepCount(job);
}

const sweepCount = (job: Job): number =>
  job.to === job.from ? 1 : Math.floor(Math.abs(job.to - job.from) / job.step + 1e-9) + 1;

export function expandJob(job: Job): Pass[] {
  passCount(job);
  const count = sweepCount(job);
  const dir = job.to >= job.from ? 1 : -1;
  const passes: Pass[] = [];
  for (let k = 0; k < job.indexCount; k++) {
    for (let i = 0; i < count; i++) {
      passes.push({
        radius: job.from + dir * i * job.step,
        depth: job.depth,
        phase: job.phaseStep * Math.floor(i / job.phaseGroup),
        pumpPhase: job.pumpPhaseStep * i,
        index: (360 * k) / job.indexCount,
      });
    }
  }
  return passes;
}
