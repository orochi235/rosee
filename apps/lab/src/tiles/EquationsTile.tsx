import { describe, equationMathML, sampleEnv, type Settings, type Toolpaths } from 'rosee';
import { useMemo } from 'react';
import type { PlayheadAt } from '../playhead';
import { equationValue } from './equationValue';
import './equations.css';

/** Each stage of the cut as equations, with the playhead's value beside each. */
export function EquationsTile({ settings, toolpaths, at }: { settings: Settings; toolpaths: Toolpaths; at: PlayheadAt }) {
  const stages = useMemo(() => describe(settings, toolpaths, at.pass), [settings, toolpaths, at.pass]);
  const printed = useMemo(
    () =>
      stages.map((st) =>
        st.equations.map((eq) => {
          const symbols = equationMathML(eq);
          const numbers = equationMathML(eq, { numbers: true });
          return { symbols, numbers: numbers === symbols ? null : numbers };
        }),
      ),
    [stages],
  );
  const env = sampleEnv(stages, settings, toolpaths, at.pass, at.sample);
  return (
    <div className="rs-equations">
      {stages.map((st, i) => (
        <section key={st.title} className="rs-eq-stage">
          <h3>{st.title}</h3>
          {st.equations.map((eq, j) => {
            const { symbols, numbers } = printed[i][j];
            return (
              <div key={eq.id} className="rs-eq">
                <div className="rs-eq-math">
                  <div dangerouslySetInnerHTML={{ __html: symbols }} />
                  {numbers && <div className="rs-eq-numbers" dangerouslySetInnerHTML={{ __html: numbers }} />}
                  {eq.note && <p className="rs-eq-note">{eq.note}</p>}
                </div>
                <output className="rs-readout rs-eq-value">{equationValue(eq, env)}</output>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
