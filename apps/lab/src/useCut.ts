import { type TrialClock, useClockFrame } from '@weasel-js/labkit';
import type { Toolpaths } from 'rosee';
import { useLayoutEffect, useMemo, useState } from 'react';
import { type LabStateValue, useLabState } from './labState';
import { machinePose, type MachinePose } from './mechanism/pose';
import { at, type PlayheadAt } from './playhead';

/** How far through the cut the trial's clock is, 0 to 1, kept current every
 *  frame it plays and on every seek. Call it inside the trial. */
export function useCutPhase(clock: TrialClock | null | undefined): number {
  const [phase, setPhase] = useState(() => clock?.phase ?? 1);
  const read = () => {
    if (clock) setPhase(clock.phase);
  };
  useClockFrame(read);
  // A layout effect, so a seek made in another one paints already moved.
  useLayoutEffect(() => clock?.subscribe(read), [clock]);
  return phase;
}

/** Where the cut has got at `phase`. */
export function headAt(phase: number, toolpaths: Toolpaths): PlayheadAt {
  const passes = toolpaths.passes.length;
  return at(phase * toolpaths.samples * passes, toolpaths.samples, passes);
}

export interface TrialCut extends LabStateValue {
  toolpaths: Toolpaths;
  head: PlayheadAt;
}

/** The lab's setup, and the cut as far as this trial's clock has played it,
 *  with that clock kept on the same cut as every other trial's. Null until
 *  the settings first cut something. */
export function useTrialCut(clock: TrialClock | undefined): TrialCut | null {
  const lab = useLabState();
  const phase = useCutPhase(clock);
  useLayoutEffect(() => (clock ? lab.link.join(clock) : undefined), [clock, lab.link]);
  const { toolpaths } = lab;
  return toolpaths ? { ...lab, toolpaths, head: headAt(phase, toolpaths) } : null;
}

/** The machine as it stands at the cut's head. */
export function usePose(cut: TrialCut | null): MachinePose | null {
  return useMemo(
    () => cut && machinePose(cut.state.settings, cut.toolpaths, cut.head),
    // head is rebuilt every render; only where it points matters
    [cut?.state.settings, cut?.toolpaths, cut?.head.pass, cut?.head.sample],
  );
}
