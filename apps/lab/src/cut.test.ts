import type { TrialClock } from '@weasel-js/labkit';
import { describe, expect, it } from 'vitest';
import { createClockLink, finish } from './cut';

/** The part of a trial clock the link touches: a position, a rate and a
 *  loop, each notifying on change as labkit's does. */
function fakeClock(duration = 1000): TrialClock {
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((fn) => fn());
  let elapsed = 0;
  let rate = 0;
  let loop: boolean | number = false;
  const span = () => (loop === false ? duration : Number.POSITIVE_INFINITY);
  return {
    duration,
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
      notify();
    },
    get loop() {
      return loop;
    },
    set loop(l: boolean | number) {
      loop = l;
      elapsed = Math.min(elapsed, span());
      notify();
    },
    seek(t: number) {
      elapsed = Math.min(Math.max(0, t), span());
      notify();
    },
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => subs.delete(fn);
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

describe('createClockLink', () => {
  it('opens the first clock finished and puts later ones where it is', () => {
    const link = createClockLink();
    const a = fakeClock();
    link.join(a);
    expect(a.elapsed).toBe(1000);
    a.seek(400);
    a.rate = 1;
    const b = fakeClock();
    link.join(b);
    expect([b.elapsed, b.rate]).toEqual([400, 1]);
  });

  it('carries a play, a seek and a loop change to every other clock', () => {
    const link = createClockLink();
    const [a, b, c] = [fakeClock(), fakeClock(), fakeClock()];
    for (const k of [a, b, c]) link.join(k);
    b.seek(250);
    c.rate = 4;
    a.loop = true;
    for (const k of [a, b, c]) expect([k.elapsed, k.rate, k.loop]).toEqual([250, 4, true]);
  });

  it('lets a clock go, and finishes the rest together', () => {
    const link = createClockLink();
    const [a, b] = [fakeClock(), fakeClock()];
    const leave = link.join(a);
    link.join(b);
    leave();
    b.seek(100);
    expect(a.elapsed).toBe(1000);
    a.seek(0);
    b.rate = 1;
    link.finish();
    expect([b.elapsed, b.rate, a.elapsed]).toEqual([1000, 0, 0]);
  });
});
