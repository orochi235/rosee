import { LabShell, Workspace } from '@weasel-js/labkit';
import { PRESETS, type PresetName, toolpathsSvg } from 'rosee';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Bare } from './Bare';
import { ErrorBoundary } from './ErrorBoundary';
import { initialState, readHash, resetToDefault, shareLink, writeHash } from './hash';
import { machinePose } from './mechanism/pose';
import { Sidebar } from './Sidebar';
import type { LabState } from './state';
import { MachineTile } from './tiles/MachineTile';
import { MechanismTile } from './tiles/MechanismTile';
import { OutputTile } from './tiles/OutputTile';
import { MotionTile } from './tiles/MotionTile';
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

function Lab() {
  const [state, setState] = useState<LabState>(initialState);
  const { toolpaths, error } = useToolpaths(state.settings);
  const samples = toolpaths?.samples ?? 1;
  const passes = toolpaths?.passes.length ?? 1;
  const playhead = usePlayhead(samples, passes);
  const head = at(playhead.head.position, samples, passes);
  const pose = useMemo(
    () => toolpaths && machinePose(state.settings, toolpaths, head),
    // head is rebuilt every render; only where it points matters
    [state.settings, toolpaths, head.pass, head.sample],
  );

  useEffect(() => {
    const id = setTimeout(() => writeHash(state), 250);
    return () => clearTimeout(id);
  }, [state]);

  useEffect(() => {
    const load = () => {
      const next = readHash();
      if (next) setState(next);
    };
    window.addEventListener('hashchange', load);
    return () => window.removeEventListener('hashchange', load);
  }, []);

  return (
    <div className="rs-layout">
      <Sidebar
        state={state}
        setSettings={(settings) => setState((s) => ({ ...s, settings, preset: '' }))}
        setLook={(look) => setState((s) => ({ ...s, look }))}
        loadPreset={(name: PresetName) => setState((s) => ({ ...s, preset: name, settings: PRESETS[name] }))}
        onExportSvg={() => {
          if (!toolpaths) return;
          // What is on screen: the cut as far as the playhead, which is all of it once finished.
          const partial = playhead.head.position < playhead.end;
          const svg = toolpathsSvg(toolpaths, { upTo: head, metadata: shareLink(state) });
          const name = `rosee-${state.preset || 'custom'}${partial ? `-pass${head.pass + 1}` : ''}.svg`;
          download(svg, name, 'image/svg+xml');
        }}
      />
      <div className="rs-main">
        {error && <p className="rs-error" role="alert">{error}</p>}
        {toolpaths && pose && (
          <div className="rs-workspace">
            <Workspace ids={['output', 'mechanism', 'plots', 'machine']} resizable>
              <Tile title="Output">
                <OutputTile toolpaths={toolpaths} cutter={state.settings.cutter} upTo={head} look={state.look} />
              </Tile>
              <Tile title="Mechanism">
                <MechanismTile settings={state.settings} toolpaths={toolpaths} at={head} pose={pose} exaggerate={state.look.exaggerate} />
              </Tile>
              <Tile title="Motion">
                <MotionTile settings={state.settings} toolpaths={toolpaths} at={head} />
              </Tile>
              <Tile title="Machine">
                <MachineTile settings={state.settings} toolpaths={toolpaths} at={head} pose={pose} exaggerate={state.look.exaggerate} />
              </Tile>
            </Workspace>
          </div>
        )}
        <Transport
          head={playhead.head}
          at={head}
          end={playhead.end}
          onToggle={playhead.toggle}
          onSeek={playhead.seek}
          onSpeed={playhead.setSpeed}
        />
      </div>
    </div>
  );
}

/** `?bare` is the output alone, for embedding the lab as a picture. */
const BARE = new URLSearchParams(location.search).has('bare');

export function App() {
  if (BARE)
    return (
      <ErrorBoundary onReset={resetToDefault}>
        <Bare />
      </ErrorBoundary>
    );
  return (
    <LabShell title="rosee" mode="dark" documentTitle="rosee — rose engine lab">
      <ErrorBoundary onReset={resetToDefault}>
        <Lab />
      </ErrorBoundary>
    </LabShell>
  );
}
