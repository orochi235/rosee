import { describe, expect, it } from 'vitest';
import { contactTable } from '../contact/table';
import type { Rosette } from '../rosette/rosette';
import { headstockToMachine, headstockToWork, machineToHeadstock, workToHeadstock } from './pose';
import { contactGap, solveSwing, swingAt, swingTable } from './swing';

describe('pose', () => {
  it('swings the spindle axis on an arc about the pivot', () => {
    const [x, y] = headstockToMachine([0, 0], 10, 0.1);
    expect(x).toBeCloseTo(-10 * Math.sin(0.1), 12);
    expect(y).toBeCloseTo(-10 + 10 * Math.cos(0.1), 12);
  });

  it('round-trips machine ↔ headstock and headstock ↔ work', () => {
    const p = [3.2, -1.1] as const;
    const [hx, hy] = machineToHeadstock(p, 120, 0.03);
    const back = headstockToMachine([hx, hy], 120, 0.03);
    expect(back[0]).toBeCloseTo(p[0], 12);
    expect(back[1]).toBeCloseTo(p[1], 12);
    const w = headstockToWork(p, 1.3, 0.4);
    const h = workToHeadstock(w, 1.3, 0.4);
    expect(h[0]).toBeCloseTo(p[0], 12);
    expect(h[1]).toBeCloseTo(p[1], 12);
  });
});

describe('swing solve', () => {
  const sine: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } };

  it('leaves the rubber just touching at every angle', () => {
    const t = contactTable(sine, { shape: 'round', radius: 1 });
    for (let i = 0; i < 200; i++) {
      const a = (i / 200) * 2 * Math.PI;
      const swing = solveSwing(t, t.mean, 60, a);
      expect(Math.abs(contactGap(t, t.mean, 60, a, swing))).toBeLessThan(1e-9);
    }
  });

  it('does not swing on a round rosette', () => {
    const round: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } };
    const t = contactTable(round, { shape: 'round', radius: 1 });
    for (const a of [0, 1, 2]) expect(solveSwing(t, t.mean, 150, a)).toBeCloseTo(0, 9);
  });

  it('swings away from the rubber on a lobe', () => {
    const t = contactTable(sine, { shape: 'round', radius: 0 });
    expect(solveSwing(t, t.mean, 150, 0)).toBeGreaterThan(0);
    expect(solveSwing(t, t.mean, 150, Math.PI / 12)).toBeLessThan(0);
  });
});

/** Every swing in [-0.15, 0.25] at which the rubber touches, by a dense scan. */
function roots(t: ReturnType<typeof contactTable>, pivot: number, a: number): number[] {
  const out: number[] = [];
  const n = 20000;
  let prev = contactGap(t, t.mean, pivot, a, -0.15);
  for (let i = 1; i <= n; i++) {
    const sw = -0.15 + (0.4 * i) / n;
    const g = contactGap(t, t.mean, pivot, a, sw);
    if (prev <= 0 !== g <= 0) out.push(sw);
    prev = g;
  }
  return out;
}

describe('swing on a wall steeper than the arc', () => {
  const petal: Rosette = { radius: 30, wave: { kind: 'petal', lobes: 24, amplitude: 3, sharpness: 6 } };
  const t = contactTable(petal, { shape: 'round', radius: 0 });
  const st = swingTable(t, t.mean, 150);

  it('rests at the largest touching swing, flagging where there are several', () => {
    let steep = 0;
    for (let k = 0; k < 400; k++) {
      const a = (k / st.swing.length) * 2 * Math.PI;
      const r = roots(t, 150, a);
      expect(st.swing[k]).toBeCloseTo(r[r.length - 1], 4);
      expect(st.steep[k]).toBe(r.length > 1 ? 1 : 0);
      steep += st.steep[k];
    }
    expect(steep).toBeGreaterThan(0);
  });

  it('only jumps where flagged steep', () => {
    const n = st.swing.length;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      if (Math.abs(st.swing[j] - st.swing[k]) > 4e-3) expect(st.steep[k] | st.steep[j]).toBe(1);
    }
  });
});

describe('swing table', () => {
  it('moves smoothly where nothing is steep', () => {
    const sine: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } };
    const t = contactTable(sine, { shape: 'round', radius: 1 });
    const st = swingTable(t, t.mean, 60);
    const n = st.swing.length;
    expect(st.steep.every((s) => s === 0)).toBe(true);
    for (let k = 0; k < n; k++) expect(Math.abs(st.swing[(k + 1) % n] - st.swing[k])).toBeLessThan(4e-3);
  });

  it('agrees with solving directly, between its samples too', () => {
    const sine: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } };
    const t = contactTable(sine, { shape: 'round', radius: 1 });
    const st = swingTable(t, t.mean, 150);
    for (const a of [0, 0.0007, 0.5, 2.31, 6.2]) {
      expect(swingAt(st, a).swing).toBeCloseTo(solveSwing(t, t.mean, 150, a), 6);
    }
  });
});
