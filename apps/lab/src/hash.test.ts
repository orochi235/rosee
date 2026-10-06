import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE } from './state';
import { stateInText } from './hash';

const token = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

describe('stateInText', () => {
  it('finds the lab link inside an exported SVG', () => {
    const state = { ...DEFAULT_STATE, preset: 'basket' };
    const svg = `<svg><metadata>https://example.com/rosee/#s=${token(state)}</metadata><g/></svg>`;
    expect(stateInText(svg)?.preset).toBe('basket');
  });

  it('returns null for a file with no link, or an unreadable one', () => {
    expect(stateInText('<svg><g/></svg>')).toBeNull();
    expect(stateInText('<metadata>#s=!!!</metadata>')).toBeNull();
    expect(stateInText('<metadata>#s=bm90IGpzb24</metadata>')).toBeNull();
  });
});
