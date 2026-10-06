import { useEffect, useMemo, useRef } from 'react';
import { initialState } from './hash';
import { useElementSize } from './hooks/useElementSize';
import { WHOLE_MACHINE } from './mechanism/machine3d';
import { machinePose } from './mechanism/pose';
import { at, usePlayhead } from './playhead';
import { MachineTile } from './tiles/MachineTile';
import { OutputTile } from './tiles/OutputTile';
import { useToolpaths } from './useToolpaths';

/** Seconds one whole cut takes to replay, whatever the pattern's pass count. */
const CUT_SECONDS = 12;
/** How long the finished pattern holds before it is cut again. */
const HOLD_MS = 3000;
/** Wider than this, and landscape, the machine gets the right half. */
const WIDE_PX = 760;

/** `?bare` is the cut and nothing else, for embedding the lab as a picture:
 *  the surface carving itself on a loop, and the machine cutting it beside
 *  it once the frame is wide enough to hold both. Reads the hash, never
 *  writes it. */
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
  const wide = size.width >= WIDE_PX && size.width >= size.height * 1.4;

  const { setSpeed, toggle } = playhead;
  useEffect(() => setSpeed(passes / CUT_SECONDS), [passes]);
  const done = !playhead.head.playing && playhead.head.position >= playhead.end;
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(toggle, HOLD_MS);
    return () => clearTimeout(id);
  }, [done, playhead.end]);

  return (
    <div className={`rs-bare${wide ? ' rs-bare-wide' : ''}`} ref={root}>
      {error && <p className="rs-error" role="alert">{error}</p>}
      {toolpaths && pose && (
        <>
          <OutputTile toolpaths={toolpaths} cutter={state.settings.cutter} upTo={head} look={state.look} />
          {wide && (
            <MachineTile
              settings={state.settings}
              toolpaths={toolpaths}
              at={head}
              pose={pose}
              exaggerate={state.look.exaggerate}
              parts={false}
              camera={WHOLE_MACHINE}
            />
          )}
        </>
      )}
    </div>
  );
}
