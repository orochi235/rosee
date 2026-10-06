import { useEffect, useMemo, useRef, useState } from 'react';
import { initialState } from './hash';
import { useElementSize } from './hooks/useElementSize';
import { WHOLE_MACHINE } from './mechanism/machine3d';
import { machinePose } from './mechanism/pose';
import { at, usePlayhead } from './playhead';
import { MachineTile } from './tiles/MachineTile';
import { OutputTile } from './tiles/OutputTile';
import { Transport } from './Transport';
import { useToolpaths } from './useToolpaths';

/** Spindle turns per second the loop plays at, so every pattern cuts at one pace. */
const SPEED = 0.25;
/** How long the finished pattern holds before it is cut again. */
const HOLD_MS = 3000;
/** Wider than this, and landscape, the machine gets the right half. */
const WIDE_PX = 760;
/** `?bare=still` is the finished cut alone at any size, never replayed: the
 *  frame a capture shoots to stand in for the narrow view. */
const params = new URLSearchParams(location.search);
const STILL = params.get('bare') === 'still';
/** `&bg=rrggbb` paints a backdrop where the page is otherwise transparent,
 *  for a capture that has to land on the embedder's color. */
const GROUND = params.get('bg')?.match(/^[0-9a-f]{3,8}$/i)?.[0];
if (GROUND) document.documentElement.style.setProperty('--rs-bare-ground', `#${GROUND}`);

/** `?bare` is the cut and nothing else, for embedding the lab as a picture:
 *  the cut drawn as lines on a loop over a transparent page, and the machine
 *  cutting it beside it once the frame is wide enough to hold both, with the
 *  transport under them. Reads the hash, never writes it. */
export function Bare() {
  const state = useMemo(initialState, []);
  const { toolpaths, error } = useToolpaths(state.settings);
  const samples = toolpaths?.samples ?? 1;
  const passes = toolpaths?.passes.length ?? 1;
  const playhead = usePlayhead(samples, passes);
  const head = at(playhead.head.position, samples, passes);
  const pose = useMemo(
    () => toolpaths && machinePose(state.settings, toolpaths, head),
    [state.settings, toolpaths, head.pass, head.sample],
  );
  const root = useRef<HTMLDivElement>(null);
  const size = useElementSize(root);
  const wide = !STILL && size.width >= WIDE_PX && size.width >= size.height * 1.4;

  const { setSpeed, toggle } = playhead;
  useEffect(() => setSpeed(SPEED), []);
  /** Once the viewer touches the transport, the loop stops replaying under them. */
  const [held, setHeld] = useState(false);
  const hold =
    <A extends unknown[]>(f: (...a: A) => void) =>
    (...a: A) => {
      setHeld(true);
      f(...a);
    };
  const done = !playhead.head.playing && playhead.head.position >= playhead.end;
  useEffect(() => {
    if (!done || STILL || held) return;
    const id = setTimeout(toggle, HOLD_MS);
    return () => clearTimeout(id);
  }, [done, playhead.end, held]);

  return (
    <div className={`rs-bare${wide ? ' rs-bare-wide' : ''}`} ref={root}>
      {error && <p className="rs-error" role="alert">{error}</p>}
      {toolpaths && pose && (
        <>
          <OutputTile
            toolpaths={toolpaths}
            cutter={state.settings.cutter}
            upTo={head}
            look={{ ...state.look, mode: 'lines' }}
            background={null}
          />
          {wide && (
            <MachineTile
              settings={state.settings}
              toolpaths={toolpaths}
              at={head}
              pose={pose}
              exaggerate={state.look.exaggerate}
              parts={false}
              camera={WHOLE_MACHINE}
              transparent
              inset
            />
          )}
          {wide && (
            <Transport
              head={playhead.head}
              at={head}
              end={playhead.end}
              onToggle={hold(toggle)}
              onSeek={hold(playhead.seek)}
              onSpeed={hold(setSpeed)}
            />
          )}
        </>
      )}
    </div>
  );
}
