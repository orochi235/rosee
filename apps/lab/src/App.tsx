import { Lab, type LabContribution, type TrialContribution, TrialTransport, useTrialClock } from '@weasel-js/labkit';
import { useLayoutEffect } from 'react';
import { cutClock, FIGURE_PACE, followCut, LAB_PACE, speedLabel } from './cut';
import { CutReadout } from './CutReadout';
import { embedOf } from './embed';
import { ErrorBoundary } from './ErrorBoundary';
import { initialState, resetToDefault } from './hash';
import { makeInstruments, TILES } from './instruments';
import { LabStateProvider, useLabState } from './labState';
import { Sidebar } from './Sidebar';

const EMBED = embedOf(location.search);
// A custom property is the one thing set inline; app.css paints the root with it.
if (EMBED?.ground) document.documentElement.style.setProperty('--rs-ground', EMBED.ground);

const PACE = EMBED ? FIGURE_PACE : LAB_PACE;
const CLOCK = cutClock(initialState().settings, PACE);
const INSTRUMENTS = makeInstruments(EMBED?.still ?? false);
/** How the transport reads a speed: as the spindle's. */
const FORMAT_SPEED = speedLabel(PACE);

const SIDEBAR: LabContribution[] = [{ id: 'setup', region: 'sidebar', render: () => <Sidebar /> }];
const STATUS: TrialContribution[] = [{ id: 'cut', region: 'status', render: () => <CutReadout /> }];
/** A trial holds nothing a snapshot could keep: the setup is the lab's, in the URL hash. */
const SUPPRESS = ['snapshot'];

/** Keeps the lab's clock on the loaded cut: as long as it takes at the lab's
 *  pace, and shown finished whenever a new one loads. */
function FollowCut() {
  const clock = useTrialClock();
  const { toolpaths } = useLabState();
  useLayoutEffect(() => {
    if (clock && toolpaths) followCut(clock, toolpaths.passes.length, PACE);
  }, [clock, toolpaths]);
  return null;
}

export function App() {
  return (
    <ErrorBoundary onReset={resetToDefault}>
      <LabStateProvider embedded={EMBED !== null}>
        {EMBED ? (
          <Lab
            present
            instruments={INSTRUMENTS}
            defaultInstrument="cut"
            seed={{ instrument: 'cut' }}
            clock={CLOCK}
            transport={false}
            title="rosee"
            mode="dark"
          >
            <FollowCut />
          </Lab>
        ) : (
          <Lab
            instruments={INSTRUMENTS}
            defaultInstrument={TILES[0]}
            opening={TILES}
            clock={CLOCK}
            title="rosee"
            documentTitle="rosee — rose and straight-line engine lab"
            mode="dark"
            labChrome={SIDEBAR}
            chrome={STATUS}
            suppress={SUPPRESS}
            footer={<TrialTransport formatRate={FORMAT_SPEED} />}
          >
            <FollowCut />
          </Lab>
        )}
      </LabStateProvider>
    </ErrorBoundary>
  );
}
