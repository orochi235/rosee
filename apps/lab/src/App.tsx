import { LabShell, Workspace } from '@weasel-js/labkit';
import { PRESETS, type PresetName, toolpathsSvg } from 'rosee';
import { type ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { initialState, type LabState, writeHash } from './state';
import { MachineTile } from './tiles/MachineTile';
import { MechanismTile } from './tiles/MechanismTile';
import { OutputTile } from './tiles/OutputTile';
import { PlotsTile } from './tiles/PlotsTile';
import { Transport } from './Transport';
import { at, usePlayhead } from './playhead';
import { useToolpaths } from './useToolpaths';

function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rs-tile">
      <h2 className="rs-tile-title">{title}</h2>
      {children}
    </section>
  );
}

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function App() {
  const [state, setState] = useState<LabState>(initialState);
  const { toolpaths, error } = useToolpaths(state.settings);
  const samples = toolpaths?.samples ?? 1;
  const passes = toolpaths?.passes.length ?? 1;
  const playhead = usePlayhead(samples, passes);
  const head = at(playhead.head.position, samples, passes);

  useEffect(() => {
    const id = setTimeout(() => writeHash(state), 250);
    return () => clearTimeout(id);
  }, [state]);

  return (
    <LabShell title="rosee" mode="dark" documentTitle="rosee — rose engine lab">
      <div className="rs-layout">
        <Sidebar
          state={state}
          setSettings={(settings) => setState((s) => ({ ...s, settings, preset: '' }))}
          setLook={(look) => setState((s) => ({ ...s, look }))}
          loadPreset={(name: PresetName) => setState((s) => ({ ...s, preset: name, settings: PRESETS[name] }))}
          onExportSvg={() => toolpaths && download(toolpathsSvg(toolpaths), `rosee-${state.preset || 'custom'}.svg`, 'image/svg+xml')}
        />
        <div className="rs-main">
          {error && <p className="rs-error" role="alert">{error}</p>}
          {toolpaths && (
            <div className="rs-workspace">
              <Workspace ids={['output', 'mechanism', 'plots', 'machine']} resizable>
                <Tile title="Output">
                  <OutputTile toolpaths={toolpaths} cutter={state.settings.cutter} upTo={head} look={state.look} />
                </Tile>
                <Tile title="Mechanism">
                  <MechanismTile settings={state.settings} toolpaths={toolpaths} at={head} exaggerate={state.look.exaggerate} />
                </Tile>
                <Tile title="Motion">
                  <PlotsTile toolpaths={toolpaths} at={head} />
                </Tile>
                <Tile title="Machine">
                  <MachineTile settings={state.settings} toolpaths={toolpaths} at={head} exaggerate={state.look.exaggerate} />
                </Tile>
              </Workspace>
            </div>
          )}
          <Transport
            head={playhead.head}
            end={playhead.end}
            samples={samples}
            passes={passes}
            onToggle={playhead.toggle}
            onSeek={playhead.seek}
            onSpeed={playhead.setSpeed}
          />
        </div>
      </div>
    </LabShell>
  );
}
