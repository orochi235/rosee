import { restore } from './restore';
import { DEFAULT_STATE, type LabState } from './state';

export function initialState(): LabState {
  return readHash() ?? DEFAULT_STATE;
}

const encode = (v: unknown): string =>
  btoa(String.fromCodePoint(...new TextEncoder().encode(JSON.stringify(v))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const decode = (s: string): unknown =>
  JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.codePointAt(0) ?? 0),
    ),
  );

/** The whole lab as a URL hash, so any state is a link. */
export function writeHash(s: LabState): void {
  history.replaceState(null, '', `#s=${encode(s)}`);
}

/** The state in the URL hash, or null when there is none or it is unreadable. */
export function readHash(): LabState | null {
  const m = location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    return restore(decode(m[1]));
  } catch {
    return null;
  }
}

/** Drops the hash and starts over from the default state. */
export function resetToDefault(): void {
  history.replaceState(null, '', location.pathname + location.search);
  location.reload();
}
