import { CurveEditor } from '@weasel-js/ui';
import type { ProfilePoint } from 'rosee';

/** One lobe of a drawn rosette: u across the lobe, peak at 0 and the valley
 *  at 0.5; the library repeats it around the rosette. */
export function ProfileEditor({ points, onChange }: { points: ProfilePoint[]; onChange(next: ProfilePoint[]): void }) {
  return (
    <figure className="rs-profile">
      <figcaption>Lobe profile</figcaption>
      <CurveEditor
        value={points.map((q) => ({ x: q.u, y: q.p }))}
        onInput={(next) => onChange(next.map((q) => ({ u: Math.min(Math.max(q.x, 0), 0.999), p: q.y })))}
        domain="1d"
        constrain="function"
        xRange={[0, 1]}
        yRange={[-1, 1]}
        width={256}
        height={120}
        minPoints={2}
        grid={{}}
      />
    </figure>
  );
}
