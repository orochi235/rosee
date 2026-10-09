import type { Toolpaths } from 'rosee';
import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useEffect, useState } from 'react';
import { type ClockLink, createClockLink } from './cut';
import { initialState, readHash, stateInText, writeHash } from './hash';
import type { LabState } from './state';
import { useToolpaths } from './useToolpaths';

export interface LabStateValue {
  state: LabState;
  setState: Dispatch<SetStateAction<LabState>>;
  toolpaths: Toolpaths | null;
  /** Why the settings cut nothing, or ''. */
  error: string;
  /** What went wrong opening a file, or ''. */
  notice: string;
  setNotice(notice: string): void;
  /** Open the settings an SVG exported from the lab carries. */
  open(file: File): Promise<void>;
  /** Keeps every trial's clock on one cut. */
  link: ClockLink;
}

const Context = createContext<LabStateValue | null>(null);

/** The setup every trial shows, shared above the lab: read from the URL hash,
 *  and unless `embedded`, written back to it, followed when it changes, and
 *  replaced by an SVG dropped anywhere on the page. */
export function LabStateProvider({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  const [state, setState] = useState<LabState>(initialState);
  const [notice, setNotice] = useState('');
  const [link] = useState(createClockLink);
  const { toolpaths, error } = useToolpaths(state.settings);
  const end = toolpaths ? toolpaths.samples * toolpaths.passes.length : 0;

  const open = async (file: File) => {
    const next = stateInText(await file.text());
    if (next) setState(next);
    setNotice(next ? '' : `${file.name} has no rosee settings in it. Only SVGs exported from this lab do.`);
  };

  // A new pattern shows finished; replaying it is a click away.
  useEffect(() => link.finish(), [link, end]);

  useEffect(() => {
    if (embedded) return;
    const id = setTimeout(() => writeHash(state), 250);
    return () => clearTimeout(id);
  }, [embedded, state]);

  useEffect(() => {
    if (embedded) return;
    const load = () => {
      const next = readHash();
      if (next) setState(next);
    };
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      e.preventDefault();
      void open(file);
    };
    window.addEventListener('hashchange', load);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('hashchange', load);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [embedded]);

  return (
    <Context.Provider value={{ state, setState, toolpaths, error, notice, setNotice, open, link }}>{children}</Context.Provider>
  );
}

export function useLabState(): LabStateValue {
  const value = useContext(Context);
  if (!value) throw new Error('useLabState() must be called inside <LabStateProvider>');
  return value;
}
