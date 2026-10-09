import { ControlPanel, useTrialClock } from '@weasel-js/labkit';
import { type Engine, PRESETS, type PresetName, type Settings, toolpathsSvg } from 'rosee';
import { useRef } from 'react';
import { chuckPanel, cutPanel, enginePanel, lookPanel, type Panel, pumpPanel, rosettePanel, rubberPanel, surfacePanel } from './panels';
import { shareLink } from './hash';
import { importRosette } from './importRosette';
import { useLabState } from './labState';
import { ProfileEditor } from './ProfileEditor';
import type { Look } from './state';
import { headAt } from './useCut';

const ENGINES: [Engine['kind'], string][] = [
  ['rose', 'Rose engine'],
  ['straight', 'Straight-line engine'],
];

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function Section<T>({ panel, value, onChange }: { panel: Panel<T>; value: T; onChange(next: T): void }) {
  const config = panel.read(value);
  return (
    <section className="rs-section">
      <h2 className="rs-heading">{panel.title}</h2>
      <ControlPanel
        schema={panel.schema}
        config={config}
        setConfig={(path, v) => onChange(panel.write(value, { ...config, [path]: v }))}
      />
    </section>
  );
}

/** Downloads what is on screen: the cut as far as the focused trial's clock,
 *  which every other trial's is kept level with. */
function ExportSvg() {
  const { state, toolpaths } = useLabState();
  const clock = useTrialClock();
  const onClick = () => {
    if (!toolpaths) return;
    const phase = clock?.phase ?? 1;
    const head = headAt(phase, toolpaths);
    const svg = toolpathsSvg(toolpaths, { upTo: head, metadata: shareLink(state) });
    const name = `rosee-${state.preset || 'custom'}${phase < 1 ? `-pass${head.pass + 1}` : ''}.svg`;
    download(svg, name, 'image/svg+xml');
  };
  return (
    <button type="button" onClick={onClick}>
      Export SVG
    </button>
  );
}

/** The setup every trial shows, and the files it goes to and comes from. */
export function Sidebar() {
  const { state, setState, error, notice, setNotice, open } = useLabState();
  const picker = useRef<HTMLInputElement>(null);
  const outline = useRef<HTMLInputElement>(null);
  const { settings } = state;
  const wave = settings.rosette.wave;
  const setSettings = (next: Settings) => setState((s) => ({ ...s, settings: next, preset: '' }));
  const setLook = (look: Look) => setState((s) => ({ ...s, look }));
  const loadPreset = (name: PresetName) => setState((s) => ({ ...s, preset: name, settings: PRESETS[name] }));
  const onImportRosette = async (file: File) => {
    try {
      const { rosette } = await importRosette(file, settings.rosette.radius);
      setState((s) => ({ ...s, preset: '', settings: { ...s.settings, rosette } }));
      setNotice('');
    } catch (e) {
      setNotice(`Could not import ${file.name}: ${(e as Error).message}.`);
    }
  };
  return (
    <aside className="rs-sidebar">
      {error && <p className="rs-error" role="alert">{error}</p>}
      {notice && <p className="rs-error" role="alert">{notice}</p>}
      <section className="rs-section">
        <label className="rs-preset">
          Preset
          <select value={state.preset} onChange={(e) => loadPreset(e.target.value as PresetName)}>
            {state.preset === '' && <option value="">Custom</option>}
            {ENGINES.map(([kind, label]) => (
              <optgroup key={kind} label={label}>
                {(Object.keys(PRESETS) as PresetName[])
                  .filter((name) => PRESETS[name].engine.kind === kind)
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="rs-buttons">
          <ExportSvg />
          <button type="button" onClick={() => picker.current?.click()}>
            Open SVG
          </button>
          <input
            ref={picker}
            className="rs-hidden"
            type="file"
            accept=".svg,image/svg+xml"
            aria-label="SVG to open"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void open(file);
              e.currentTarget.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(shareLink(state))}
          >
            Copy link
          </button>
        </div>
      </section>
      <Section panel={enginePanel} value={settings} onChange={setSettings} />
      <Section panel={rosettePanel} value={settings} onChange={setSettings} />
      <div className="rs-buttons">
        <button type="button" onClick={() => outline.current?.click()}>
          Import rosette
        </button>
        <input
          ref={outline}
          className="rs-hidden"
          type="file"
          accept=".svg,.dxf,image/*"
          aria-label="Rosette outline to import: an SVG or DXF drawing, or a photo"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) void onImportRosette(file);
            e.currentTarget.value = '';
          }}
        />
      </div>
      {wave.kind === 'drawn' && (
        <ProfileEditor
          points={wave.points}
          onChange={(points) => setSettings({ ...settings, rosette: { ...settings.rosette, wave: { ...wave, points } } })}
        />
      )}
      <Section panel={rubberPanel} value={settings} onChange={setSettings} />
      <Section panel={pumpPanel} value={settings} onChange={setSettings} />
      {settings.engine.kind === 'rose' && (
        <>
          <Section panel={chuckPanel} value={settings} onChange={setSettings} />
          <Section panel={surfacePanel} value={settings} onChange={setSettings} />
        </>
      )}
      <Section panel={cutPanel} value={settings} onChange={setSettings} />
      <Section panel={lookPanel} value={state.look} onChange={setLook} />
    </aside>
  );
}
