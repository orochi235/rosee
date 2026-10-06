import { computeToolpaths, type Settings, type Toolpaths } from 'rosee';
import { useDeferredValue, useMemo, useRef } from 'react';

/** Toolpaths for the settings, computed off the urgent render so a slider
 *  drag stays responsive. On bad settings it keeps the last good toolpaths
 *  and reports why. */
export function useToolpaths(settings: Settings): { toolpaths: Toolpaths | null; error: string } {
  const deferred = useDeferredValue(settings);
  const last = useRef<Toolpaths | null>(null);
  return useMemo(() => {
    try {
      last.current = computeToolpaths(deferred);
      return { toolpaths: last.current, error: '' };
    } catch (e) {
      return { toolpaths: last.current, error: (e as Error).message };
    }
  }, [deferred]);
}
