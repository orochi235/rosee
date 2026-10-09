import type { ClockCapability, TrialClock } from '@weasel-js/labkit';
import { passCount, type Settings } from 'rosee';

/** Spindle turns per second the cut plays at 1×: the lab's, and the slower
 *  pace an embedded figure plays at. */
export const LAB_PACE = 2;
export const FIGURE_PACE = 0.25;

/** A trial clock that runs the whole cut as one pass, so the transport's
 *  scrub bar, loop and replay act on the cut. labkit reads a clock's duration
 *  once, when the trial opens, so the cut takes the time the opening pattern
 *  takes at `pace` turns per second, and a pattern loaded later plays in that
 *  same time. */
export function cutClock(settings: Settings, pace: number): ClockCapability {
  let passes = 1;
  try {
    passes = passCount(settings.job);
  } catch {
    // A job computeToolpaths will refuse; the lab shows why.
  }
  return { duration: (passes * 1000) / pace };
}

/** Pause `clock` on the finished cut. Looping, that is the end of the pass it
 *  is in, since the start of the next one is an empty cut. */
export function finish(clock: TrialClock): void {
  clock.rate = 0;
  clock.seek(clock.loop === false ? clock.duration : (clock.pass + 1) * clock.duration - 1e-6);
}

export interface ClockLink {
  /** Put `clock` on the cut the others are at, or on the finished cut when it
   *  is the first. Returns the way to leave. */
  join(clock: TrialClock): () => void;
  /** Pause every clock on the finished cut. */
  finish(): void;
}

/** Keeps the clocks of every trial in a lab on one cut: playing, pausing,
 *  seeking, a change of speed or loop on any of them reaches the rest. */
export function createClockLink(): ClockLink {
  const clocks = new Map<TrialClock, () => void>();
  let following = false;
  const copy = (from: TrialClock, to: TrialClock) => {
    if (to.loop !== from.loop) to.loop = from.loop;
    if (to.elapsed !== from.elapsed) to.seek(from.elapsed);
    if (to.rate !== from.rate) to.rate = from.rate;
  };
  const follow = (lead: TrialClock) => {
    if (following) return;
    following = true;
    try {
      for (const other of clocks.keys()) if (other !== lead) copy(lead, other);
    } finally {
      following = false;
    }
  };
  return {
    join(clock) {
      const [lead] = clocks.keys();
      if (lead) copy(lead, clock);
      else finish(clock);
      clocks.set(clock, clock.subscribe(() => follow(clock)));
      return () => {
        clocks.get(clock)?.();
        clocks.delete(clock);
      };
    },
    finish() {
      const [lead] = clocks.keys();
      if (lead) finish(lead);
    },
  };
}
