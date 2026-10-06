import type { Settings, Toolpaths } from 'rosee';
import { useState } from 'react';
import type { PlayheadAt } from '../playhead';
import { Tabs } from '../Tabs';
import { EquationsTile } from './EquationsTile';
import { PlotsTile } from './PlotsTile';

const TABS = ['Plots', 'Equations'] as const;

export function MotionTile({ settings, toolpaths, at }: { settings: Settings; toolpaths: Toolpaths; at: PlayheadAt }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Plots');
  return (
    <div className="rs-tile-body">
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'Plots' ? (
        <PlotsTile toolpaths={toolpaths} at={at} chuck={settings.chuck !== null} />
      ) : (
        <EquationsTile settings={settings} toolpaths={toolpaths} at={at} />
      )}
    </div>
  );
}
