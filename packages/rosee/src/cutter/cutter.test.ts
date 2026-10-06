import { expect, it } from 'vitest';
import { grooveWidth } from './cutter';

it('a 90° cutter cuts a groove twice as wide as it is deep, plus its tip flat', () => {
  expect(grooveWidth({ vAngle: 90, tipFlat: 0 }, 0.1)).toBeCloseTo(0.2, 12);
  expect(grooveWidth({ vAngle: 90, tipFlat: 0.02 }, 0.1)).toBeCloseTo(0.22, 12);
});
