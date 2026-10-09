import { describe, expect, it } from 'vitest';
import { embedOf } from './embed';

describe('embedOf', () => {
  it('is the full lab without bare', () => {
    expect(embedOf('')).toBeNull();
    expect(embedOf('?bg=ffffff')).toBeNull();
  });

  it('replays the cut for ?bare and holds it still for ?bare=still', () => {
    expect(embedOf('?bare')).toEqual({ still: false, ground: null });
    expect(embedOf('?bare=')).toEqual({ still: false, ground: null });
    expect(embedOf('?bare=still')).toEqual({ still: true, ground: null });
  });

  it('paints a hex backdrop and ignores anything else', () => {
    expect(embedOf('?bare&bg=0b0d12')?.ground).toBe('#0b0d12');
    expect(embedOf('?bare=still&bg=FFF')?.ground).toBe('#FFF');
    expect(embedOf('?bare&bg=red')?.ground).toBeNull();
    expect(embedOf('?bare&bg=12;color:red')?.ground).toBeNull();
  });
});
