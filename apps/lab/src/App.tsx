import { Lab, type LabContribution, type TrialContribution, TrialTransport, useLabContext, usePresentation } from '@weasel-js/labkit';
import { useEffect, useRef } from 'react';
import { cutClock, FIGURE_PACE, LAB_PACE } from './cut';
import { CutReadout } from './CutReadout';
import { embedOf } from './embed';
import { ErrorBoundary } from './ErrorBoundary';
import { initialState, resetToDefault } from './hash';
import { makeInstruments, TILES } from './instruments';
import { LabStateProvider } from './labState';
import { Sidebar } from './Sidebar';

const EMBED = embedOf(location.search);
// A custom property is the one thing set inline; app.css paints the root with it.
if (EMBED?.ground) document.documentElement.style.setProperty('--rs-ground', EMBED.ground);

const INSTRUMENTS = makeInstruments(cutClock(initialState().settings, EMBED ? FIGURE_PACE : LAB_PACE), EMBED?.still ?? false);

const SIDEBAR: LabContribution[] = [{ id: 'setup', region: 'sidebar', render: () => <Sidebar /> }];
const STATUS: TrialContribution[] = [{ id: 'cut', region: 'status', render: () => <CutReadout /> }];
/** A trial holds nothing a snapshot could keep: the setup is the lab's, in the URL hash. */
const SUPPRESS = ['snapshot'];

/** Opens the rest of the tiles beside the one `<Lab>` opens on, once. */
function OpenTiles() {
  const lab = useLabContext();
  const { active } = usePresentation();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || active) return;
    opened.current = true;
    const first = lab.trials[0]?.id;
    for (const name of TILES.slice(1)) lab.addTrial(name);
    if (first) lab.focusTrial(first);
  }, []);
  return null;
}

export function App() {
  return (
    <ErrorBoundary onReset={resetToDefault}>
      <LabStateProvider embedded={EMBED !== null}>
        {EMBED ? (
          <Lab present instruments={INSTRUMENTS} defaultInstrument="cut" seed={{ instrument: 'cut' }} transport={false} title="rosee" mode="dark" />
        ) : (
          <Lab
            instruments={INSTRUMENTS}
            defaultInstrument={TILES[0]}
            title="rosee"
            mode="dark"
            labChrome={SIDEBAR}
            chrome={STATUS}
            suppress={SUPPRESS}
            footer={<TrialTransport />}
          >
            <OpenTiles />
          </Lab>
        )}
      </LabStateProvider>
    </ErrorBoundary>
  );
}
