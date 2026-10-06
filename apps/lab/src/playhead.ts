import { useEffect, useRef, useState } from 'react';

/** Where the cut has got, as a sample count from the first pass's start:
 *  `pass * samples + sample`. The end is every pass cut in full. */
export interface Playhead {
  position: number;
  playing: boolean;
  /** Spindle turns per second. */
  speed: number;
}

export interface PlayheadAt {
  pass: number;
  sample: number;
}

export const at = (position: number, samples: number, passes: number): PlayheadAt => {
  const p = Math.min(Math.floor(position / samples), passes - 1);
  return { pass: Math.max(p, 0), sample: Math.round(position - Math.max(p, 0) * samples) };
};

/** Plays the cut forward, a pass at a time, stopping at the end. */
export function usePlayhead(samples: number, passes: number) {
  const end = samples * passes;
  const [head, setHead] = useState<Playhead>({ position: end, playing: false, speed: 2 });
  const endRef = useRef(end);
  endRef.current = end;

  // A new pattern shows finished; replaying it is a click away.
  useEffect(() => setHead((h) => ({ ...h, position: end, playing: false })), [end]);

  useEffect(() => {
    if (!head.playing) return;
    let last = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      // A frame's timestamp can precede the moment this effect ran.
      const dt = Math.max(0, now - last) / 1000;
      last = now;
      setHead((h) => {
        const position = Math.min(h.position + h.speed * samples * dt, endRef.current);
        return { ...h, position, playing: position < endRef.current };
      });
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [head.playing, samples]);

  return {
    head,
    end,
    toggle: () => setHead((h) => ({ ...h, playing: !h.playing, position: h.position >= end ? 0 : h.position })),
    seek: (position: number) => setHead((h) => ({ ...h, position, playing: false })),
    setSpeed: (speed: number) => setHead((h) => ({ ...h, speed })),
  };
}
