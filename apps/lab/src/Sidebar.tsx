import { ControlPanel } from '@weasel-js/labkit';
import { PRESETS, type PresetName, type Settings } from 'rosee';
import { cutPanel, lookPanel, type Panel, pumpPanel, rosettePanel, rubberPanel } from './panels';
import { writeHash } from './hash';
import { ProfileEditor } from './ProfileEditor';
import type { LabState, Look } from './state';

interface Props {
  state: LabState;
  setSettings(next: Settings): void;
  setLook(next: Look): void;
  loadPreset(name: PresetName): void;
  onExportSvg(): void;
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

export function Sidebar({ state, setSettings, setLook, loadPreset, onExportSvg }: Props) {
  const { settings } = state;
  const wave = settings.rosette.wave;
  return (
    <aside className="rs-sidebar">
      <section className="rs-section">
        <label className="rs-preset">
          Preset
          <select value={state.preset} onChange={(e) => loadPreset(e.target.value as PresetName)}>
            {state.preset === '' && <option value="">Custom</option>}
            {Object.keys(PRESETS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="rs-buttons">
          <button type="button" onClick={onExportSvg}>
            Export SVG
          </button>
          <button
            type="button"
            onClick={() => {
              writeHash(state);
              navigator.clipboard?.writeText(location.href);
            }}
          >
            Copy link
          </button>
        </div>
      </section>
      <Section panel={rosettePanel} value={settings} onChange={setSettings} />
      {wave.kind === 'drawn' && (
        <ProfileEditor
          points={wave.points}
          onChange={(points) => setSettings({ ...settings, rosette: { ...settings.rosette, wave: { ...wave, points } } })}
        />
      )}
      <Section panel={rubberPanel} value={settings} onChange={setSettings} />
      <Section panel={pumpPanel} value={settings} onChange={setSettings} />
      <Section panel={cutPanel} value={settings} onChange={setSettings} />
      <Section panel={lookPanel} value={state.look} onChange={setLook} />
    </aside>
  );
}
