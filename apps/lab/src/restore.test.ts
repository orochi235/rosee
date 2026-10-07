import { computeToolpaths, PRESETS } from 'rosee';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CHUCKS, DEFAULT_POINTS, DEFAULT_PUMP } from './defaults';
import { chuckPanel, cutPanel, lookPanel, pumpPanel, rosettePanel, rubberPanel } from './panels';
import { restore } from './restore';
import { DEFAULT_LOOK, type LabState } from './state';

const settingsOf = (settings: unknown) => restore({ settings })!.settings;

describe('restore', () => {
  const state: LabState = { preset: 'basket', settings: PRESETS.basket, look: { ...DEFAULT_LOOK, mode: 'split' } };

  it('gives back a state that went through JSON', () => {
    expect(restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('restores a hash from before surfaces to a face', () => {
    const { surface: _, ...old } = PRESETS.swirl;
    expect(settingsOf(JSON.parse(JSON.stringify(old))).surface).toEqual({ kind: 'flat' });
  });

  it('restores a hash from before engines to a rose engine, and the straight preset as it was', () => {
    const { engine: _, ...old } = PRESETS.swirl;
    expect(settingsOf(JSON.parse(JSON.stringify(old))).engine).toEqual({ kind: 'rose' });
    expect(settingsOf(JSON.parse(JSON.stringify(PRESETS.straight)))).toEqual(PRESETS.straight);
  });

  it('restores a barrel', () => {
    expect(settingsOf(JSON.parse(JSON.stringify(PRESETS.barrel)))).toEqual(PRESETS.barrel);
  });

  it('rejects anything without a settings object', () => {
    for (const raw of [null, 3, 'x', {}, { settings: [] }, { settings: 'x' }]) expect(restore(raw)).toBeNull();
  });

  it('fills empty settings sections from the default preset, so every panel can read them', () => {
    const s = settingsOf({ rosette: {}, rubber: {}, job: {}, cutter: {} });
    expect(s).toEqual(PRESETS.swirl);
    for (const panel of [rosettePanel, rubberPanel, pumpPanel, chuckPanel, cutPanel]) expect(() => panel.read(s)).not.toThrow();
  });

  it('falls back per field on values of the wrong type', () => {
    const s = settingsOf({ rosette: { radius: 'big', wave: { kind: 'sine', lobes: 7, amplitude: null } }, job: { step: '0.1', depth: 0.2 } });
    expect(s.rosette).toEqual({ radius: 30, wave: { kind: 'sine', lobes: 7, amplitude: 1 } });
    expect(s.job).toEqual({ ...PRESETS.swirl.job, depth: 0.2 });
  });

  it('replaces unknown kinds and shapes, keeping the fields that still fit', () => {
    expect(settingsOf({ rosette: { wave: { kind: 'bogus', lobes: 5 } } }).rosette.wave).toEqual({ kind: 'sine', lobes: 5, amplitude: 1 });
    expect(settingsOf({ rosette: { wave: { kind: 'petal' } } }).rosette.wave).toEqual({ kind: 'petal', lobes: 12, amplitude: 1.5, sharpness: 2 });
    expect(settingsOf({ rubber: { shape: 'hex', radius: 2 } }).rubber).toEqual({ shape: 'round', radius: 2 });
    expect(settingsOf({ rubber: { shape: 'flat' } }).rubber).toEqual({ shape: 'flat', width: 6 });
  });

  it('checks drawn points and compound waves', () => {
    const drawn = settingsOf({ rosette: { wave: { kind: 'drawn', points: [{ u: 0, p: 'x' }] } } }).rosette.wave;
    expect(drawn.kind === 'drawn' && drawn.points).toEqual(DEFAULT_POINTS);
    expect(settingsOf({ rosette: { wave: { kind: 'compound', waves: [] } } }).rosette.wave).toEqual(PRESETS.swirl.rosette.wave);
    expect(settingsOf({ rosette: { wave: { kind: 'compound', waves: [{ lobes: 3 }] } } }).rosette.wave).toEqual({
      kind: 'compound',
      waves: [{ kind: 'sine', lobes: 3, amplitude: 1 }],
    });
  });

  it('keeps a pump only when it is an object, filling its parts', () => {
    expect(settingsOf({ pump: {} }).pump).toEqual(DEFAULT_PUMP);
    expect(settingsOf({ pump: null }).pump).toBeNull();
    expect(settingsOf({ pump: 'on' }).pump).toBeNull();
  });

  it('falls back on a look field that is not one of its choices', () => {
    const r = restore({ settings: {}, look: { metal: 'x', mode: 'nope', resolution: 3000, azimuth: '9', elevation: 50 } });
    expect(r?.look).toEqual({ ...DEFAULT_LOOK, elevation: 50 });
    expect(() => lookPanel.read(r!.look)).not.toThrow();
  });

  it('forgets a preset that is not one of its own', () => {
    for (const preset of ['nope', 'constructor', '__proto__', 'toString', 7]) expect(restore({ preset, settings: {} })?.preset).toBe('');
  });

  it('leaves an out-of-range sample count for the library to refuse', () => {
    expect(() => computeToolpaths(settingsOf({ samplesPerTurn: 0 }))).toThrow(/samplesPerTurn must be a whole number/);
  });

  it('restores a hash from before chucks to no chuck and a plain job', () => {
    const { chuck: _, ...old } = PRESETS.swirl;
    const { wheelCount: __, eccentricityStep: ___, ...oldJob } = old.job;
    expect(settingsOf({ ...old, job: oldJob })).toEqual(PRESETS.swirl);
  });

  it('fills a chuck from the defaults for its kind', () => {
    expect(settingsOf({ chuck: { kind: 'bogus', eccentricity: 3 } }).chuck).toEqual({ ...DEFAULT_CHUCKS.eccentric, eccentricity: 3 });
    expect(settingsOf({ chuck: { kind: 'elliptical' } }).chuck).toEqual(DEFAULT_CHUCKS.elliptical);
    expect(settingsOf({ chuck: null }).chuck).toBeNull();
    expect(settingsOf({ chuck: 'yes' }).chuck).toBeNull();
  });

  it('keeps a chuck preset through JSON', () => {
    expect(settingsOf(JSON.parse(JSON.stringify(PRESETS.oval)))).toEqual(PRESETS.oval);
  });

  it('resets the chuck job fields of a hash that has no chuck, so it still cuts', () => {
    const s = settingsOf({ chuck: null, job: { wheelCount: 3, eccentricityStep: 0.5 } });
    expect(s.job.wheelCount).toBe(1);
    expect(s.job.eccentricityStep).toBe(0);
    expect(() => computeToolpaths({ ...s, samplesPerTurn: 256 })).not.toThrow();
  });
});
