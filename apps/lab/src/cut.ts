import type { ClockCapability, TrialClock } from '@weasel-js/labkit';
import { passCount, type Settings } from 'rosee';

/** Spindle turns per second the cut plays at 1×: the lab's, and the slower
 *  pace an embedded figure plays at. */
export const LAB_PACE = 2;
export const FIGURE_PACE = 0.25;

/** The spindle speeds a transport offers, in turns per second. */
const SPEEDS = [1 / 64, 1 / 32, 1 / 16, 1 / 8, 0.25, 0.5, 1, 2, 4, 8];

/** ms the whole cut takes at 1×, `passes` turns at `pace` turns per second. */
export const cutLength = (passes: number, pace: number): number => (passes * 1000) / pace;

/** A clock rate as the spindle speed it plays at; slow speeds read better as
 *  the seconds one turn takes. */
export const speedLabel =
  (pace: number) =>
  (rate: number): string => {
    const turns = rate * pace;
    return turns < 1 ? `${+(1 / turns).toFixed(1)} s/turn` : `${+turns.toFixed(2)} turn/s`;
  };

/** The lab's clock, running the whole cut as one pass so the transport's
 *  scrub bar, loop and replay act on the cut. It opens on the finished cut of
 *  `settings`; `followCut` keeps its length on whatever cut is loaded since. */
export function cutClock(settings: Settings, pace: number): ClockCapability {
  let passes = 1;
  try {
    passes = passCount(settings.job);
  } catch {
    // A job computeToolpaths will refuse; the lab shows why.
  }
  return { duration: cutLength(passes, pace), start: 'end', rates: SPEEDS.map((s) => s / pace) };
}

/** Pause `clock` on the finished cut. Looping, that is the end of the pass it
 *  is in, since the start of the next one is an empty cut. */
export function finish(clock: TrialClock): void {
  clock.rate = 0;
  clock.seek(clock.loop === false ? clock.duration : (clock.pass + 1) * clock.duration - 1e-6);
}

/** Put `clock` on a newly loaded cut of `passes` turns: as long as it takes
 *  at `pace`, and shown finished, with replaying it a click away. */
export function followCut(clock: TrialClock, passes: number, pace: number): void {
  clock.duration = cutLength(passes, pace);
  finish(clock);
}
