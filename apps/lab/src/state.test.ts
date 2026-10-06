import { PRESETS } from 'rosee';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, type LabState, restore } from './state';

describe('restore', () => {
  const state: LabState = { preset: 'basket', settings: PRESETS.basket, look: { ...DEFAULT_LOOK, mode: 'split' } };

  it('gives back a state that went through JSON', () => {
    expect(restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('rejects anything without machine settings', () => {
    expect(restore(null)).toBeNull();
    expect(restore({ settings: { rosette: {} } })).toBeNull();
  });

  it('fills a missing look and forgets an unknown preset', () => {
    const r = restore({ preset: 'nope', settings: PRESETS.swirl });
    expect(r?.preset).toBe('');
    expect(r?.look).toEqual(DEFAULT_LOOK);
  });
});
