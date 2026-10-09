import { type ClockCapability, defineInstrument, type InstrumentList, type TrialClock } from '@weasel-js/labkit';
import type { ComponentType } from 'react';
import { CutFigure } from './CutFigure';
import { MachineTile } from './tiles/MachineTile';
import { MechanismTile } from './tiles/MechanismTile';
import { MotionTile } from './tiles/MotionTile';
import { OutputTile } from './tiles/OutputTile';
import { usePose, useTrialCut } from './useCut';

interface TrialProps {
  clock: TrialClock | undefined;
}

function OutputTrial({ clock }: TrialProps) {
  const cut = useTrialCut(clock);
  if (!cut) return null;
  return (
    <div className="rs-tile">
      <OutputTile toolpaths={cut.toolpaths} cutter={cut.state.settings.cutter} upTo={cut.head} look={cut.state.look} />
    </div>
  );
}

function MechanismTrial({ clock }: TrialProps) {
  const cut = useTrialCut(clock);
  const pose = usePose(cut);
  if (!cut || !pose) return null;
  const { state, toolpaths, head } = cut;
  return (
    <div className="rs-tile">
      <MechanismTile settings={state.settings} toolpaths={toolpaths} at={head} pose={pose} exaggerate={state.look.exaggerate} />
    </div>
  );
}

function MotionTrial({ clock }: TrialProps) {
  const cut = useTrialCut(clock);
  if (!cut) return null;
  return (
    <div className="rs-tile">
      <MotionTile settings={cut.state.settings} toolpaths={cut.toolpaths} at={cut.head} />
    </div>
  );
}

function MachineTrial({ clock }: TrialProps) {
  const cut = useTrialCut(clock);
  const pose = usePose(cut);
  if (!cut || !pose) return null;
  const { state, toolpaths, head } = cut;
  return (
    <div className="rs-tile">
      <MachineTile settings={state.settings} toolpaths={toolpaths} at={head} pose={pose} exaggerate={state.look.exaggerate} />
    </div>
  );
}

/** The tiles the full lab opens on, in order. */
export const TILES = ['output', 'mechanism', 'motion', 'machine'] as const;

/** One instrument per tile, and the cut as a figure for an embed. None has a
 *  config or state of its own: every trial shows the one setup the sidebar
 *  edits and the URL hash holds, and plays on `clock`. */
export function makeInstruments(clock: ClockCapability, still: boolean): InstrumentList {
  const instrument = (name: string, title: string, Body: ComponentType<TrialProps>) =>
    defineInstrument<null, Record<string, never>>({
      name,
      title,
      defaultConfig: () => ({}),
      initialState: () => null,
      clock,
      render: (ctx) => <Body clock={ctx.trial.clock} />,
    });
  const Figure = ({ clock: c }: TrialProps) => <CutFigure clock={c} still={still} />;
  return [
    instrument('output', 'Output', OutputTrial),
    instrument('mechanism', 'Mechanism', MechanismTrial),
    instrument('motion', 'Motion', MotionTrial),
    instrument('machine', 'Machine', MachineTrial),
    instrument('cut', 'Cut', Figure),
  ];
}
