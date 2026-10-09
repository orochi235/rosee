import { type TrialClock, TrialTransport } from '@weasel-js/labkit';
import { useRef } from 'react';
import { CutReadout } from './CutReadout';
import { useElementSize } from './hooks/useElementSize';
import { useLabState } from './labState';
import { WHOLE_MACHINE } from './mechanism/machine3d';
import { MachineTile } from './tiles/MachineTile';
import { OutputTile } from './tiles/OutputTile';
import { usePose, useTrialCut } from './useCut';

/** Wider than this, and landscape, the machine gets the right half. */
const WIDE_PX = 760;
/** How long the finished cut holds before it is cut again. */
const REPLAY_MS = 3000;

/** The cut as a figure, for embedding the lab as a picture: the cut drawn as
 *  lines on a loop over nothing, and the machine cutting it beside it once
 *  the frame is wide enough to hold both, with the play controls under them.
 *  `still` is the finished cut alone at any size, never replayed.
 *
 *  The play controls are mounted, hidden, while the frame is narrow, because
 *  they are what replays the cut. labkit's own presented controls show from
 *  480px wide, and cannot be told to show only beside the machine. */
export function CutFigure({ clock, still }: { clock: TrialClock | undefined; still: boolean }) {
  const { error } = useLabState();
  const cut = useTrialCut(clock);
  const pose = usePose(cut);
  const root = useRef<HTMLDivElement>(null);
  const size = useElementSize(root);
  const wide = !still && size.width >= WIDE_PX && size.width >= size.height * 1.4;
  return (
    <div className={`rs-cut${wide ? ' rs-cut-wide' : ''}`} ref={root}>
      {error && <p className="rs-error" role="alert">{error}</p>}
      {cut && pose && (
        <>
          <OutputTile
            toolpaths={cut.toolpaths}
            cutter={cut.state.settings.cutter}
            upTo={cut.head}
            look={{ ...cut.state.look, mode: 'lines' }}
            background={null}
          />
          {wide && (
            <MachineTile
              settings={cut.state.settings}
              toolpaths={cut.toolpaths}
              at={cut.head}
              pose={pose}
              exaggerate={cut.state.look.exaggerate}
              parts={false}
              camera={WHOLE_MACHINE}
              transparent
              inset
            />
          )}
        </>
      )}
      {!still && (
        <div className={wide ? 'rs-cut-bar' : 'rs-hidden'}>
          <TrialTransport keys={wide} replay={REPLAY_MS} className="rs-cut-transport" />
          <CutReadout />
        </div>
      )}
    </div>
  );
}
