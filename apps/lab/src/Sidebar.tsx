import { ControlPanel } from '@weasel-js/labkit';
import { type Engine, PRESETS, type PresetName, type Settings } from 'rosee';
import { useRef } from 'react';
import { chuckPanel, cutPanel, enginePanel, lookPanel, type Panel, pumpPanel, rosettePanel, rubberPanel, surfacePanel } from './panels';
import { shareLink } from './hash';
import { ProfileEditor } from './ProfileEditor';
import type { LabState, Look } from './state';

const ENGINES: [Engine['kind'], string][] = [
  ['rose', 'Rose engine'],
  ['straight', 'Straight-line engine'],
];

interface Props {
  state: LabState;
  setSettings(next: Settings): void;
  setLook(next: Look): void;
  loadPreset(name: PresetName): void;
  onExportSvg(): void;
  onOpen(file: File): void;
  onImportRosette(file: File): void;
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

export function Sidebar({ state, setSettings, setLook, loadPreset, onExportSvg, onOpen, onImportRosette }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const outline = useRef<HTMLInputElement>(null);
  const { settings } = state;
  const wave = settings.rosette.wave;
  return (
    <aside className="rs-sidebar">
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
          <button type="button" onClick={onExportSvg}>
            Export SVG
          </button>
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
              if (file) onOpen(file);
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
            if (file) onImportRosette(file);
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
