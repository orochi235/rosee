import { useTrialClock } from '@weasel-js/labkit';
import { useLabState } from './labState';
import { headAt, useCutPhase } from './useCut';

/** Which pass the trial it renders in has cut to, and the spindle's angle. */
export function CutReadout() {
  const { toolpaths } = useLabState();
  const phase = useCutPhase(useTrialClock());
  if (!toolpaths) return null;
  const head = headAt(phase, toolpaths);
  return (
    <span className="rs-readouts">
      <span className="rs-readout rs-pass">{head.label}</span>
      <span className="rs-readout rs-angle">{head.degrees.toFixed(1)}°</span>
    </span>
  );
}
