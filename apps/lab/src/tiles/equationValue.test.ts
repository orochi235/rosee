import { computeToolpaths, describe as describeCut, equation, PRESETS, sampleEnv } from 'rosee';
import { describe, expect, it } from 'vitest';
import { equationValue } from './equationValue';

const s = { ...PRESETS.oval, samplesPerTurn: 64 };
const t = computeToolpaths(s);
const stages = describeCut(s, t, 3);
const env = sampleEnv(stages, s, t, 3, 10);

describe('equationValue', () => {
  it('prints the tip in mm, with typographic minus signs', () => {
    const [x, y] = [t.passes[3].xyz[30], t.passes[3].xyz[31]];
    const shown = `(${x.toFixed(3)}, ${y.toFixed(3)}) mm`.replace(/-/g, '−');
    expect(equationValue(equation(stages, 'chain'), env)).toBe(shown);
  });

  it('shows a definition its left side when the playhead binds it, in wrapped degrees', () => {
    const value = equationValue(equation(stages, 'swing'), env);
    expect(value).toMatch(/^−?\d+\.\d{3}°$/);
  });

  it('shows nothing for a function of free arguments', () => {
    expect(equationValue(equation(stages, 'headstock'), env)).toBe('');
  });
});
