import type { TrialClock } from '@weasel-js/labkit';
import { describe, expect, it } from 'vitest';
import { cutClock, finish, followCut, speedLabel } from './cut';
import { DEFAULT_STATE } from './state';

/** The part of a trial clock the cut touches: a position, a rate, a loop and
 *  a duration whose change keeps the phase, as labkit's does. */
function fakeClock(start = 1000): TrialClock {
  let duration = start;
  let elapsed = 0;
  let rate = 0;
  let loop: boolean | number = false;
  const span = () => (loop === false ? duration : Number.POSITIVE_INFINITY);
  return {
    get duration() {
      return duration;
    },
    set duration(d: number) {
      elapsed = (elapsed / duration) * d;
      duration = d;
    },
    get elapsed() {
      return elapsed;
    },
    get pass() {
      return Math.floor(Math.min(elapsed, span() - 1e-9) / duration);
    },
    get rate() {
      return rate;
    },
    set rate(r: number) {
      rate = r;
    },
    get loop() {
      return loop;
    },
    set loop(l: boolean | number) {
      loop = l;
    },
    seek(t: number) {
      elapsed = Math.min(Math.max(0, t), span());
    },
  } as unknown as TrialClock;
}

describe('finish', () => {
  it('pauses at the end of the cut', () => {
    const c = fakeClock();
    c.rate = 2;
    finish(c);
    expect([c.rate, c.elapsed]).toEqual([0, 1000]);
  });

  it('stays in the pass it is in while looping', () => {
    const c = fakeClock();
    c.loop = true;
    c.seek(2500);
    finish(c);
    expect(c.elapsed).toBeCloseTo(3000, 3);
    expect(c.elapsed).toBeLessThan(3000);
  });
});

describe('followCut', () => {
  it('keeps the pace per turn on a cut of another length, and shows it finished', () => {
    const c = fakeClock(3000);
    c.seek(1000);
    c.rate = 1;
    followCut(c, 12, 2);
    expect([c.duration, c.elapsed, c.rate]).toEqual([6000, 6000, 0]);
  });
});

describe('cutClock', () => {
  it('opens finished, offering 64 s a turn to 8 turns a second', () => {
    const clock = cutClock(DEFAULT_STATE.settings, 2);
    expect(clock.start).toBe('end');
    const label = speedLabel(2);
    const rates = clock.rates ?? [];
    expect(label(rates[0] as number)).toBe('64 s/turn');
    expect(label(rates.at(-1) as number)).toBe('8 turn/s');
    expect(label(1)).toBe('2 turn/s');
  });
});
