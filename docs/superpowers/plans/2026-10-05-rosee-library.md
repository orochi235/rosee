# rosee library implementation plan (plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: written 2026-10-05, not started.** Plan 2 (the `rosee/gl` carve and lit
surface) and plan 3 (the labkit lab) are not written yet; both consume this
library's `computeToolpaths` output.

**Goal:** The pure-TypeScript `rosee` library: rosettes, rubber contact, the
headstock swing solve, pumping, jobs, and toolpaths, with SVG export and presets.

**Architecture:** Plain-data `Settings` go in; `computeToolpaths` returns per-pass
`Float32Array`s of cutter-tip positions in work coordinates plus the per-sample
machine state (swing, pump travel, contact angle). Contact is a precomputed *reach
table* (how far out the rubber stops in each direction around the rosette); the
swing is solved once per rosette angle into a *swing table* that every pass reads.
Spec: `docs/superpowers/specs/2026-10-05-rose-engine-design.md`.

**Tech stack:** TypeScript 7, Vitest 5, npm workspaces, Node from `.nvmrc`.

Every file's code below has been run: the whole suite passed (40 tests) in a
scratch copy before this plan was written.

## Conventions

- Lengths in mm, angles in degrees in `Settings` and `Pass`, radians inside.
- Machine frame: looking along the spindle at the work's face; x toward the rubber
  and cutter, y up, origin on the spindle axis at rest. The headstock rocks about a
  pivot `pivotDistance` mm below the axis; positive swing carries the rosette away
  from the rubber.
- Work frame: turns with the spindle. Phase and index both turn the pattern
  positively.
- Tests live beside the file they test (`foo.ts` → `foo.test.ts`).
- Run one test file: `npx vitest run src/<path>` from `packages/rosee`.

## File map

```
package.json, .nvmrc, .gitignore         workspace root
packages/rosee/package.json, tsconfig*.json
packages/rosee/src/
  angle.ts                TAU, deg↔rad, turnFraction
  params.ts               ParamSpec: params as data for the lab
  rosette/profile.ts      lobe shapes u∈[0,1) → [-1,1]
  rosette/rosette.ts      Rosette, Wave, radiusAt, WAVE_PARAMS
  contact/table.ts        Rubber, reach table, reachAt
  machine/pose.ts         frame transforms
  machine/swing.ts        swing solve, swing table
  cutter/cutter.ts        Cutter, grooveWidth
  surface/surface.ts      Surface, flatFace
  job/job.ts              Job program → Pass[]
  toolpath/settings.ts    Settings, Pump
  toolpath/toolpath.ts    computeToolpaths
  export/svg.ts           toolpathsSvg
  presets.ts              swirl, basket, barleycorn
  index.ts                public surface
```


### Task 1: Workspace scaffold

**Files:**
- Create: `package.json`, `.nvmrc`
- Modify: `.gitignore` (already ignores `node_modules/`, `dist/`)
- Create: `packages/rosee/package.json`, `packages/rosee/tsconfig.json`, `packages/rosee/tsconfig.build.json`

- [ ] **Step 1: Write the root `package.json`**

```json
{
  "name": "rosee-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "npm run build -w rosee",
    "test": "npm test -w rosee --",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

- [ ] **Step 2: Write `.nvmrc`**

```
24
```

- [ ] **Step 3: Write `packages/rosee/package.json`**

```json
{
  "name": "rosee",
  "version": "0.0.0",
  "description": "Rose engine lathe simulator: rosettes, rubber contact, headstock motion and the toolpaths they cut",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vitest": "^5.0.1"
  }
}
```

- [ ] **Step 4: Write `packages/rosee/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Write `packages/rosee/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "declaration": true, "sourceMap": true },
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 6: Install**

Run: `npm install` (repo root)
Expected: creates `package-lock.json` and `node_modules/`; no errors. Commit the
lockfile; never commit a `pnpm-lock.yaml`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .nvmrc packages/rosee/package.json packages/rosee/tsconfig.json packages/rosee/tsconfig.build.json
git commit -m "scaffold npm workspace and rosee package

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 2: Angles and params

**Files:**
- Create: `packages/rosee/src/angle.ts`
- Create: `packages/rosee/src/params.ts`

- [ ] **Step 1: Write `packages/rosee/src/angle.ts`**

```ts
export const TAU = Math.PI * 2;

export const rad = (deg: number): number => (deg * Math.PI) / 180;
export const deg = (r: number): number => (r * 180) / Math.PI;

/** Fraction of a turn in [0, 1). */
export const turnFraction = (a: number): number => (((a / TAU) % 1) + 1) % 1;
```

- [ ] **Step 2: Write `packages/rosee/src/params.ts`**

```ts
/** A parameter described as plain data, so the lab can build a control for
 *  it without the library knowing about the lab. */
export type ParamSpec = NumberParam | ChoiceParam;

export interface NumberParam {
  type: 'number';
  key: string;
  label: string;
  default: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}

export interface ChoiceParam {
  type: 'choice';
  key: string;
  label: string;
  default: string;
  options: readonly string[];
}

export const num = (
  key: string,
  label: string,
  def: number,
  min: number,
  max: number,
  step: number,
  suffix?: string,
): NumberParam => ({ type: 'number', key, label, default: def, min, max, step, suffix });

export const choice = (key: string, label: string, def: string, options: readonly string[]): ChoiceParam => ({
  type: 'choice',
  key,
  label,
  default: def,
  options,
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` (in `packages/rosee`)
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/rosee/src/angle.ts packages/rosee/src/params.ts
git commit -m "add angle helpers and param specs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 3: Lobe profiles

**Files:**
- Create: `packages/rosee/src/rosette/profile.ts`
- Create: `packages/rosee/src/rosette/profile.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/rosee/src/rosette/profile.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { drawnLobe, flatLobe, petalLobe, scallopLobe, sineLobe } from './profile';

describe('lobe profiles', () => {
  const kinds = { sine: sineLobe, flat: flatLobe(0.4), petal: petalLobe(2), scallop: scallopLobe };
  for (const [name, p] of Object.entries(kinds)) {
    it(`${name} peaks at u=0 and bottoms at u=0.5`, () => {
      expect(p(0)).toBeCloseTo(1, 9);
      expect(p(0.5)).toBeCloseTo(-1, 9);
    });
    it(`${name} is symmetric about the peak`, () => {
      for (const u of [0.05, 0.13, 0.31, 0.44]) expect(p(u)).toBeCloseTo(p(1 - u), 9);
    });
  }

  it('flat holds its top across the flat fraction', () => {
    const p = flatLobe(0.4);
    expect(p(0.09)).toBe(1);
    expect(p(0.5 - 0.09)).toBe(-1);
  });

  it('drawn passes through its control points and wraps without a seam', () => {
    const p = drawnLobe([
      { u: 0, p: 1 },
      { u: 0.3, p: -0.2 },
      { u: 0.5, p: -1 },
      { u: 0.7, p: -0.2 },
    ]);
    expect(p(0)).toBeCloseTo(1, 9);
    expect(p(0.3)).toBeCloseTo(-0.2, 9);
    expect(p(0.5)).toBeCloseTo(-1, 9);
    expect(p(0.9999999)).toBeCloseTo(p(0), 4);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/rosette/profile.test.ts` (in `packages/rosee`)
Expected: FAIL — cannot resolve `./profile`

- [ ] **Step 3: Write `packages/rosee/src/rosette/profile.ts`**

```ts
/** One lobe's shape: `u` is the position within the lobe in [0, 1), with the
 *  lobe's peak at u = 0. Returns a value in [-1, 1]: 1 at the peak, -1 at the
 *  valley floor. */
export type LobeProfile = (u: number) => number;

/** Distance from the nearest peak, in [0, 0.5]. */
const fromPeak = (u: number): number => Math.min(u, 1 - u);

export const sineLobe: LobeProfile = (u) => Math.cos(2 * Math.PI * u);

/** Flat top and flat floor, each `flat` of the half-period wide, joined by
 *  cosine ramps. */
export const flatLobe =
  (flat: number): LobeProfile =>
  (u) => {
    const d = fromPeak(u);
    const h = flat / 4;
    if (d <= h) return 1;
    if (d >= 0.5 - h) return -1;
    return Math.cos((Math.PI * (d - h)) / (0.5 - 2 * h));
  };

/** Pointed peaks. `sharpness` 1 is a triangle wave; higher narrows the peak. */
export const petalLobe =
  (sharpness: number): LobeProfile =>
  (u) =>
    2 * Math.pow(1 - 2 * fromPeak(u), sharpness) - 1;

/** Rounded arcs bulging outward, meeting in sharp inward cusps. */
export const scallopLobe: LobeProfile = (u) => {
  const d = 2 * fromPeak(u);
  return 2 * Math.sqrt(1 - d * d) - 1;
};

export interface ProfilePoint {
  u: number;
  p: number;
}

/** A hand-drawn lobe: control points (u in [0, 1), p in [-1, 1]) joined by a
 *  periodic Catmull-Rom spline, so the lobe repeats without a seam. */
export const drawnLobe = (points: readonly ProfilePoint[]): LobeProfile => {
  const pts = [...points].sort((a, b) => a.u - b.u);
  const n = pts.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => pts[0].p;
  const at = (i: number): ProfilePoint => {
    const k = ((i % n) + n) % n;
    const wraps = Math.floor(i / n);
    return { u: pts[k].u + wraps, p: pts[k].p };
  };
  return (u) => {
    let i = pts.findIndex((q) => q.u > u) - 1;
    if (i === -2) i = n - 1;
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const uu = u < p1.u ? u + 1 : u;
    const t = (uu - p1.u) / (p2.u - p1.u);
    const m1 = ((p2.p - p0.p) / (p2.u - p0.u)) * (p2.u - p1.u);
    const m2 = ((p3.p - p1.p) / (p3.u - p1.u)) * (p2.u - p1.u);
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1.p + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2.p + (t3 - t2) * m2;
  };
};
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/rosette/profile.test.ts` and `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/rosee/src/rosette/profile.ts packages/rosee/src/rosette/profile.test.ts
git commit -m "add five lobe profiles for rosette waves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 4: Rosettes

**Files:**
- Create: `packages/rosee/src/rosette/rosette.ts`
- Create: `packages/rosee/src/rosette/rosette.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/rosee/src/rosette/rosette.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { displacement, radiusAt, type Rosette, type Wave } from './rosette';

describe('rosette', () => {
  const sine: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } };

  it('is radius + amplitude at a peak and radius - amplitude at a valley', () => {
    expect(radiusAt(sine, 0)).toBeCloseTo(31.5, 9);
    expect(radiusAt(sine, Math.PI / 12)).toBeCloseTo(28.5, 9);
  });

  it('repeats once per lobe', () => {
    for (const a of [0.1, 0.7, 2.2]) expect(radiusAt(sine, a)).toBeCloseTo(radiusAt(sine, a + (2 * Math.PI) / 12), 9);
  });

  it('compound sums its waves', () => {
    const a: Wave = { kind: 'sine', lobes: 12, amplitude: 1 };
    const b: Wave = { kind: 'petal', lobes: 3, amplitude: 0.5, sharpness: 2 };
    const c: Wave = { kind: 'compound', waves: [a, b] };
    for (const t of [0, 0.4, 1.9]) expect(displacement(c, t)).toBeCloseTo(displacement(a, t) + displacement(b, t), 12);
  });

  it('a zero-amplitude wave is a circle', () => {
    const round: Rosette = { radius: 25, wave: { kind: 'sine', lobes: 7, amplitude: 0 } };
    for (const t of [0, 1, 2, 3]) expect(radiusAt(round, t)).toBe(25);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/rosette/rosette.test.ts` (in `packages/rosee`)
Expected: FAIL — cannot resolve `./rosette`

- [ ] **Step 3: Write `packages/rosee/src/rosette/rosette.ts`**

```ts
import { turnFraction } from '../angle';
import { num, type ParamSpec } from '../params';
import { drawnLobe, flatLobe, type LobeProfile, petalLobe, type ProfilePoint, scallopLobe, sineLobe } from './profile';

/** A rosette's wave: `lobes` repeats of a lobe shape, `amplitude` mm from the
 *  mean radius to a peak. */
export type Wave =
  | { kind: 'sine'; lobes: number; amplitude: number }
  | { kind: 'flat'; lobes: number; amplitude: number; flat: number }
  | { kind: 'petal'; lobes: number; amplitude: number; sharpness: number }
  | { kind: 'scallop'; lobes: number; amplitude: number }
  | { kind: 'drawn'; lobes: number; amplitude: number; points: ProfilePoint[] }
  | { kind: 'compound'; waves: Wave[] };

export type WaveKind = Wave['kind'];

/** A rosette: a wave around a mean radius, both in mm. */
export interface Rosette {
  radius: number;
  wave: Wave;
}

const lobeProfile = (w: Exclude<Wave, { kind: 'compound' }>): LobeProfile => {
  switch (w.kind) {
    case 'sine':
      return sineLobe;
    case 'flat':
      return flatLobe(w.flat);
    case 'petal':
      return petalLobe(w.sharpness);
    case 'scallop':
      return scallopLobe;
    case 'drawn':
      return drawnLobe(w.points);
  }
};

/** Radial displacement of the wave from the mean radius at rosette-local
 *  angle `a` (radians), in mm. */
export function displacement(w: Wave, a: number): number {
  if (w.kind === 'compound') return w.waves.reduce((sum, c) => sum + displacement(c, a), 0);
  return w.amplitude * lobeProfile(w)(turnFraction(a * w.lobes));
}

/** Outline radius at rosette-local angle `a` (radians). */
export const radiusAt = (r: Rosette, a: number): number => r.radius + displacement(r.wave, a);

/** Params each simple wave kind exposes, as data for the lab's panels. */
export const WAVE_PARAMS: Record<Exclude<WaveKind, 'compound'>, ParamSpec[]> = {
  sine: [num('lobes', 'Lobes', 12, 1, 96, 1), num('amplitude', 'Amplitude', 1.5, 0, 10, 0.05, 'mm')],
  flat: [
    num('lobes', 'Lobes', 12, 1, 96, 1),
    num('amplitude', 'Amplitude', 1.5, 0, 10, 0.05, 'mm'),
    num('flat', 'Flat fraction', 0.4, 0, 0.9, 0.01),
  ],
  petal: [
    num('lobes', 'Lobes', 12, 1, 96, 1),
    num('amplitude', 'Amplitude', 1.5, 0, 10, 0.05, 'mm'),
    num('sharpness', 'Sharpness', 2, 1, 6, 0.1),
  ],
  scallop: [num('lobes', 'Lobes', 12, 1, 96, 1), num('amplitude', 'Amplitude', 1.5, 0, 10, 0.05, 'mm')],
  drawn: [num('lobes', 'Lobes', 12, 1, 96, 1), num('amplitude', 'Amplitude', 1.5, 0, 10, 0.05, 'mm')],
};
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/rosette/rosette.test.ts` and `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/rosee/src/rosette/rosette.ts packages/rosee/src/rosette/rosette.test.ts
git commit -m "add rosettes as a wave around a mean radius

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 5: Reach table (rubber contact)

**Files:**
- Create: `packages/rosee/src/contact/table.ts`
- Create: `packages/rosee/src/contact/table.test.ts`

A round rubber of radius 0 has no outline points within 0 of the ray, so it takes the outline radius directly; without that branch every direction comes out `-Infinity`.


- [ ] **Step 1: Write the failing test** — `packages/rosee/src/contact/table.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { radiusAt, type Rosette } from '../rosette/rosette';
import { contactTable, reachAt } from './table';

describe('contact table', () => {
  const sine: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } };

  it('a knife edge follows the outline exactly', () => {
    const t = contactTable(sine, { shape: 'round', radius: 0 });
    for (const a of [0, 0.2, 1.7, 4]) expect(reachAt(t, a)).toBeCloseTo(radiusAt(sine, a), 4);
  });

  it('a round rubber on a circle sits one rubber radius out', () => {
    const round: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } };
    const t = contactTable(round, { shape: 'round', radius: 2 });
    for (const a of [0, 1, 2]) expect(reachAt(t, a)).toBeCloseTo(32, 4);
  });

  it('a rubber smaller than the valley reaches the floor', () => {
    const sharp: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 1.5 } };
    const valley = Math.PI / 24;
    const t = contactTable(sharp, { shape: 'round', radius: 0.2 });
    expect(reachAt(t, valley) - 0.2 - radiusAt(sharp, valley)).toBeLessThan(1e-3);
  });

  it('a rubber larger than the valley bridges it', () => {
    const sharp: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 1.5 } };
    const valley = Math.PI / 24;
    const t = contactTable(sharp, { shape: 'round', radius: 3 });
    expect(reachAt(t, valley) - 3 - radiusAt(sharp, valley)).toBeGreaterThan(0.5);
  });

  it('a flat rubber reaches the peaks either side of a valley', () => {
    const sharp: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 1.5 } };
    const t = contactTable(sharp, { shape: 'flat', width: 10 });
    expect(t.min).toBeGreaterThan(radiusAt(sharp, Math.PI / 24) + 1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/contact/table.test.ts` (in `packages/rosee`)
Expected: FAIL — cannot resolve `./table`

- [ ] **Step 3: Write `packages/rosee/src/contact/table.ts`**

```ts
import { TAU, turnFraction } from '../angle';
import { radiusAt, type Rosette } from '../rosette/rosette';

/** The rubber's profile in the rosette's plane. A round rubber of radius 0 is
 *  a knife edge. A flat rubber is a face square to its line of approach. */
export type Rubber = { shape: 'round'; radius: number } | { shape: 'flat'; width: number };

/** How far from the rosette's center the rubber's reference point sits when
 *  touching, for each direction around the rosette. The reference point is
 *  the center of a round rubber and the face of a flat one. Directions are
 *  rosette-local, `samples` evenly spaced from 0. */
export interface ContactTable {
  reach: Float64Array;
  mean: number;
  min: number;
  max: number;
}

export const CONTACT_SAMPLES = 4096;

/** Builds the table by testing every outline point near each direction: a
 *  round rubber centered on the ray touches outline point p at distance
 *  p∥ + √(ρ² − p⊥²), and the rubber stops at the farthest such point. That
 *  is what makes a big rubber bridge a narrow valley. */
export function contactTable(rosette: Rosette, rubber: Rubber, samples = CONTACT_SAMPLES): ContactTable {
  const reach = new Float64Array(samples);
  const half = rubber.shape === 'round' ? rubber.radius : rubber.width / 2;
  if (half === 0) {
    for (let k = 0; k < samples; k++) reach[k] = radiusAt(rosette, (k / samples) * TAU);
  } else {
    const xs = new Float64Array(samples);
    const ys = new Float64Array(samples);
    let rmin = Infinity;
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * TAU;
      const r = radiusAt(rosette, a);
      rmin = Math.min(rmin, r);
      xs[i] = r * Math.cos(a);
      ys[i] = r * Math.sin(a);
    }
    const window = half >= rmin ? samples / 2 : Math.ceil((Math.asin(half / rmin) / TAU) * samples) + 2;
    for (let k = 0; k < samples; k++) {
      const a = (k / samples) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      let best = -Infinity;
      for (let j = k - window; j <= k + window; j++) {
        const i = ((j % samples) + samples) % samples;
        const along = xs[i] * c + ys[i] * s;
        const across = ys[i] * c - xs[i] * s;
        if (Math.abs(across) > half) continue;
        const d = rubber.shape === 'round' ? along + Math.sqrt(half * half - across * across) : along;
        if (d > best) best = d;
      }
      reach[k] = best;
    }
  }
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const d of reach) {
    sum += d;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return { reach, mean: sum / samples, min, max };
}

/** Reach at rosette-local angle `a` (radians), linearly interpolated. */
export function reachAt(t: ContactTable, a: number): number {
  const n = t.reach.length;
  const x = turnFraction(a) * n;
  const i = Math.floor(x);
  const f = x - i;
  return t.reach[i % n] * (1 - f) + t.reach[(i + 1) % n] * f;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/contact/table.test.ts` and `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/rosee/src/contact/table.ts packages/rosee/src/contact/table.test.ts
git commit -m "add rubber contact as a reach table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 6: Headstock pose and swing solve

**Files:**
- Create: `packages/rosee/src/machine/pose.ts`
- Create: `packages/rosee/src/machine/swing.ts`
- Create: `packages/rosee/src/machine/machine.test.ts`

Plain bisection works but costs 60 contact evaluations per solve; Illinois (regula falsi with halving) converges in a handful. The swing table is what makes `computeToolpaths` fast: one solve per rosette angle instead of one per sample per pass (about 1 s → 80–220 ms on the presets).


- [ ] **Step 1: Write the failing test** — `packages/rosee/src/machine/machine.test.ts`

```ts
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

describe('swing table', () => {
  it('agrees with solving directly, between its samples too', () => {
    const sine: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } };
    const t = contactTable(sine, { shape: 'round', radius: 1 });
    const st = swingTable(t, t.mean, 150);
    for (const a of [0, 0.0007, 0.5, 2.31, 6.2]) {
      expect(swingAt(st, a).swing).toBeCloseTo(solveSwing(t, t.mean, 150, a), 6);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/machine/machine.test.ts` (in `packages/rosee`)
Expected: FAIL — cannot resolve `./pose`

- [ ] **Step 3: Write `packages/rosee/src/machine/pose.ts`**

```ts
/** Machine frame: looking along the spindle at the work's face, x toward the
 *  rubber and cutter, y up, origin on the spindle axis at rest. The headstock
 *  frame coincides with it at rest; the headstock rocks by `swing` radians
 *  about a pivot `pivotDistance` mm below the spindle axis. */
export type Vec2 = readonly [number, number];

const rotate = ([x, y]: Vec2, a: number): Vec2 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * x - s * y, s * x + c * y];
};

/** A machine-frame point in the headstock frame. */
export function machineToHeadstock(p: Vec2, pivotDistance: number, swing: number): Vec2 {
  const [x, y] = rotate([p[0], p[1] + pivotDistance], -swing);
  return [x, y - pivotDistance];
}

/** A headstock-frame point in the machine frame. */
export function headstockToMachine(p: Vec2, pivotDistance: number, swing: number): Vec2 {
  const [x, y] = rotate([p[0], p[1] + pivotDistance], swing);
  return [x, y - pivotDistance];
}

/** A headstock-frame point in the work frame. The work turns with the
 *  spindle (`spindle` radians) and is set back on the division plate by
 *  `index` radians, so a positive index turns the cut pattern positively. */
export const headstockToWork = (p: Vec2, spindle: number, index: number): Vec2 => rotate(p, index - spindle);

/** A work-frame point in the headstock frame. */
export const workToHeadstock = (p: Vec2, spindle: number, index: number): Vec2 => rotate(p, spindle - index);
```

- [ ] **Step 4: Write `packages/rosee/src/machine/swing.ts`**

```ts
import { turnFraction } from '../angle';
import { type ContactTable, reachAt } from '../contact/table';
import { machineToHeadstock } from './pose';

/** The headstock's swing angle at which the rubber, fixed at
 *  (`rubberX`, 0) in the machine frame, just touches the rosette. The rosette
 *  turns with the spindle and is phased `rosetteAngle` = spindle + phase
 *  radians. Positive swing carries the rosette away from the rubber, so the
 *  gap grows with swing; a bracket is widened from the rosette's throw and
 *  then closed by the Illinois method. */
export function solveSwing(table: ContactTable, rubberX: number, pivotDistance: number, rosetteAngle: number): number {
  const gap = (swing: number): number => contactGap(table, rubberX, pivotDistance, rosetteAngle, swing);
  let d = (table.max - table.min) / pivotDistance + 1e-9;
  while (!(gap(-d) < 0 && gap(d) > 0)) {
    d *= 2;
    if (d > 1) throw new Error('swing solve: no contact within one radian of swing');
  }
  let lo = -d;
  let hi = d;
  let glo = gap(lo);
  let ghi = gap(hi);
  let side = 0;
  let swing = 0;
  for (let i = 0; i < 100; i++) {
    swing = (lo * ghi - hi * glo) / (ghi - glo);
    const g = gap(swing);
    if (Math.abs(g) < 1e-11) break;
    if (g > 0) {
      hi = swing;
      ghi = g;
      if (side === 1) glo /= 2;
      side = 1;
    } else {
      lo = swing;
      glo = g;
      if (side === -1) ghi /= 2;
      side = -1;
    }
  }
  return swing;
}

/** Contact residual at a swing: zero when the rubber just touches. */
export function contactGap(
  table: ContactTable,
  rubberX: number,
  pivotDistance: number,
  rosetteAngle: number,
  swing: number,
): number {
  const [hx, hy] = machineToHeadstock([rubberX, 0], pivotDistance, swing);
  return Math.hypot(hx, hy) - reachAt(table, Math.atan2(hy, hx) - rosetteAngle);
}

/** Swing and contact angle solved once per rosette angle, evenly spaced over
 *  a turn. The swing depends only on the rosette's angle, not on the cutter
 *  or the work, so every pass reads from one table. */
export interface SwingTable {
  swing: Float64Array;
  contact: Float64Array;
}

export function swingTable(table: ContactTable, rubberX: number, pivotDistance: number): SwingTable {
  const n = table.reach.length;
  const swing = new Float64Array(n);
  const contact = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI;
    const sw = solveSwing(table, rubberX, pivotDistance, a);
    const [hx, hy] = machineToHeadstock([rubberX, 0], pivotDistance, sw);
    swing[k] = sw;
    contact[k] = Math.atan2(hy, hx);
  }
  return { swing, contact };
}

/** Swing and rosette-local contact angle at a rosette angle, interpolated. */
export function swingAt(t: SwingTable, rosetteAngle: number): { swing: number; contact: number } {
  const n = t.swing.length;
  const x = turnFraction(rosetteAngle) * n;
  const i = Math.floor(x);
  const f = x - i;
  const j = (i + 1) % n;
  const k = i % n;
  return {
    swing: t.swing[k] * (1 - f) + t.swing[j] * f,
    contact: t.contact[k] * (1 - f) + t.contact[j] * f - rosetteAngle,
  };
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run src/machine/machine.test.ts` and `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/rosee/src/machine/pose.ts packages/rosee/src/machine/swing.ts packages/rosee/src/machine/machine.test.ts
git commit -m "solve headstock swing against the rosette

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 7: Cutter and surface

**Files:**
- Create: `packages/rosee/src/cutter/cutter.ts`
- Create: `packages/rosee/src/cutter/cutter.test.ts`
- Create: `packages/rosee/src/surface/surface.ts`

`Surface` has no caller in this plan; plan 2's carve maps toolpaths through it, and cylinders and domes (roadmap) are new `Surface`s.


- [ ] **Step 1: Write the failing test** — `packages/rosee/src/cutter/cutter.test.ts`

```ts
import { expect, it } from 'vitest';
import { grooveWidth } from './cutter';

it('a 90° cutter cuts a groove twice as wide as it is deep, plus its tip flat', () => {
  expect(grooveWidth({ vAngle: 90, tipFlat: 0 }, 0.1)).toBeCloseTo(0.2, 12);
  expect(grooveWidth({ vAngle: 90, tipFlat: 0.02 }, 0.1)).toBeCloseTo(0.22, 12);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/cutter/cutter.test.ts` (in `packages/rosee`)
Expected: FAIL — cannot resolve `./cutter`

- [ ] **Step 3: Write `packages/rosee/src/cutter/cutter.ts`**

```ts
import { rad } from '../angle';

/** A V graver: included angle in degrees, and the width of the flat ground
 *  on its tip in mm (0 for a sharp point). */
export interface Cutter {
  vAngle: number;
  tipFlat: number;
}

/** Width of the groove the cutter leaves at a cut depth, in mm. */
export const grooveWidth = (c: Cutter, depth: number): number => c.tipFlat + 2 * depth * Math.tan(rad(c.vAngle) / 2);
```

- [ ] **Step 4: Write `packages/rosee/src/surface/surface.ts`**

```ts
/** The surface being cut. Maps a cutter tip in work coordinates (mm; z
 *  negative into the stock) to the carve domain: (u, v) across the surface
 *  and h, the height relative to the uncut surface. */
export interface Surface {
  kind: string;
  toDomain(x: number, y: number, z: number): [u: number, v: number, h: number];
}

/** Face work: the end face of the stock, cut flat on. */
export const flatFace: Surface = { kind: 'flat', toDomain: (x, y, z) => [x, y, z] };
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run src/cutter/cutter.test.ts` and `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/rosee/src/cutter/cutter.ts packages/rosee/src/cutter/cutter.test.ts packages/rosee/src/surface/surface.ts
git commit -m "add V cutter and flat-face surface

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 8: Jobs

**Files:**
- Create: `packages/rosee/src/job/job.ts`
- Create: `packages/rosee/src/job/job.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/rosee/src/job/job.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { expandJob, type Job } from './job';

const base: Job = { from: 10, to: 12, step: 0.5, depth: 0.05, phaseStep: 15, phaseGroup: 1, pumpPhaseStep: 0, indexCount: 1 };

describe('expandJob', () => {
  it('steps the radius from `from` to `to` inclusive', () => {
    expect(expandJob(base).map((p) => p.radius)).toEqual([10, 10.5, 11, 11.5, 12]);
  });

  it('steps inward when `to` is below `from`', () => {
    expect(expandJob({ ...base, from: 12, to: 11 }).map((p) => p.radius)).toEqual([12, 11.5, 11]);
  });

  it('phases every pass, or every group of passes', () => {
    expect(expandJob(base).map((p) => p.phase)).toEqual([0, 15, 30, 45, 60]);
    expect(expandJob({ ...base, phaseGroup: 2 }).map((p) => p.phase)).toEqual([0, 0, 15, 15, 30]);
  });

  it('repeats the sweep at each division', () => {
    const passes = expandJob({ ...base, indexCount: 4 });
    expect(passes).toHaveLength(20);
    expect([...new Set(passes.map((p) => p.index))]).toEqual([0, 90, 180, 270]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/job/job.test.ts` (in `packages/rosee`)
Expected: FAIL — cannot resolve `./job`

- [ ] **Step 3: Write `packages/rosee/src/job/job.ts`**

```ts
/** One turn of the spindle with the cutter at one setting. Angles in
 *  degrees: `phase` turns the rosette against the work, `pumpPhase` the
 *  pumping rosette, `index` the work on the division plate. */
export interface Pass {
  radius: number;
  depth: number;
  phase: number;
  pumpPhase: number;
  index: number;
}

/** A program of passes, as the lab edits it: the cutter steps from radius
 *  `from` to `to` by `step` mm; every `phaseGroup` passes the rosette is
 *  phased on by `phaseStep`°, the pump by `pumpPhaseStep`° every pass; and
 *  the whole sweep repeats at `indexCount` even divisions of the work. */
export interface Job {
  from: number;
  to: number;
  step: number;
  depth: number;
  phaseStep: number;
  phaseGroup: number;
  pumpPhaseStep: number;
  indexCount: number;
}

export function expandJob(job: Job): Pass[] {
  const count = Math.floor(Math.abs(job.to - job.from) / job.step + 1e-9) + 1;
  const dir = job.to >= job.from ? 1 : -1;
  const passes: Pass[] = [];
  for (let k = 0; k < job.indexCount; k++) {
    for (let i = 0; i < count; i++) {
      passes.push({
        radius: job.from + dir * i * job.step,
        depth: job.depth,
        phase: job.phaseStep * Math.floor(i / job.phaseGroup),
        pumpPhase: job.pumpPhaseStep * i,
        index: (360 * k) / job.indexCount,
      });
    }
  }
  return passes;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/job/job.test.ts` and `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/rosee/src/job/job.ts packages/rosee/src/job/job.test.ts
git commit -m "add job programs that expand to passes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 9: Toolpaths

**Files:**
- Create: `packages/rosee/src/toolpath/settings.ts`
- Create: `packages/rosee/src/toolpath/toolpath.ts`
- Create: `packages/rosee/src/toolpath/toolpath.test.ts`

These are the spec's known-answer cases. The ideal formula r = R + a·cos(n(ψ − phase)) holds only with a knife-edge rubber and a very long pivot arm; the tolerance (2e-4 mm) is the reach table's linear interpolation error on a 12-lobe rosette.


- [ ] **Step 1: Write the failing test** — `packages/rosee/src/toolpath/toolpath.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Job } from '../job/job';
import type { Settings } from './settings';
import { computeToolpaths } from './toolpath';

const job = (over: Partial<Job> = {}): Job => ({
  from: 20,
  to: 20,
  step: 1,
  depth: 0.05,
  phaseStep: 0,
  phaseGroup: 1,
  pumpPhaseStep: 0,
  indexCount: 1,
  ...over,
});

const settings = (over: Partial<Settings> = {}): Settings => ({
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } },
  rubber: { shape: 'round', radius: 0 },
  pivotDistance: 1e5,
  pump: null,
  cutter: { vAngle: 90, tipFlat: 0 },
  job: job(),
  samplesPerTurn: 720,
  ...over,
});

/** Worst distance from the ideal r = R + a·cos(n(ψ − phase)). */
function idealError(s: Settings, phaseDeg = 0): number {
  const path = computeToolpaths(s).passes[0];
  const phase = (phaseDeg * Math.PI) / 180;
  let worst = 0;
  for (let i = 0; i < path.xyz.length / 3; i++) {
    const x = path.xyz[i * 3];
    const y = path.xyz[i * 3 + 1];
    const ideal = 20 + 1.5 * Math.cos(12 * (Math.atan2(y, x) - phase));
    worst = Math.max(worst, Math.abs(Math.hypot(x, y) - ideal));
  }
  return worst;
}

describe('computeToolpaths', () => {
  it('cuts a circle with a round rosette', () => {
    const s = settings({ rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } }, pivotDistance: 150 });
    const path = computeToolpaths(s).passes[0];
    for (let i = 0; i < path.xyz.length / 3; i++) {
      expect(Math.hypot(path.xyz[i * 3], path.xyz[i * 3 + 1])).toBeCloseTo(20, 5);
    }
  });

  it('matches the ideal formula with a knife edge and a very long arm', () => {
    expect(idealError(settings())).toBeLessThan(2e-4);
    expect(idealError(settings({ job: job({ phaseStep: 10, from: 20, to: 20 }) }))).toBeLessThan(2e-4);
  });

  it('rotates the lobes by the phase', () => {
    const s = settings({ job: job({ from: 20, to: 21, step: 1, phaseStep: 7 }) });
    const second = { ...s, job: job({ phaseStep: 0 }) };
    expect(idealError(second, 0)).toBeLessThan(2e-4);
    const path = computeToolpaths(s).passes[1];
    expect(path.pass.phase).toBe(7);
    let worst = 0;
    for (let i = 0; i < path.xyz.length / 3; i++) {
      const x = path.xyz[i * 3];
      const y = path.xyz[i * 3 + 1];
      const ideal = 21 + 1.5 * Math.cos(12 * (Math.atan2(y, x) - (7 * Math.PI) / 180));
      worst = Math.max(worst, Math.abs(Math.hypot(x, y) - ideal));
    }
    expect(worst).toBeLessThan(2e-4);
  });

  it('distorts more the shorter the pivot arm', () => {
    const near = idealError(settings({ pivotDistance: 60 }));
    const far = idealError(settings({ pivotDistance: 600 }));
    expect(near).toBeGreaterThan(1e-3);
    expect(near).toBeGreaterThan(5 * far);
  });

  it('cuts the same path a whole lobe of phase later', () => {
    const a = computeToolpaths(settings()).passes[0].xyz;
    const b = computeToolpaths(settings({ job: job({ phaseStep: 30, from: 20, to: 21 }) })).passes[1].xyz;
    const a21 = computeToolpaths(settings({ job: job({ from: 21, to: 21 }) })).passes[0].xyz;
    expect(a.length).toBe(b.length);
    for (let i = 0; i < b.length; i++) expect(Math.abs(b[i] - a21[i])).toBeLessThan(1e-4);
  });

  it('turns the pattern by the index', () => {
    const s = settings({ pivotDistance: 150, job: job({ indexCount: 4 }) });
    const [p0, p1] = computeToolpaths(s).passes;
    expect(p1.pass.index).toBe(90);
    for (let i = 0; i < p0.xyz.length / 3; i++) {
      const [x, y] = [p0.xyz[i * 3], p0.xyz[i * 3 + 1]];
      expect(p1.xyz[i * 3]).toBeCloseTo(-y, 4);
      expect(p1.xyz[i * 3 + 1]).toBeCloseTo(x, 4);
    }
  });

  it('cuts at constant depth without a pump', () => {
    const path = computeToolpaths(settings()).passes[0];
    for (let i = 2; i < path.xyz.length; i += 3) expect(path.xyz[i]).toBeCloseTo(-0.05, 7);
  });

  it('pumps the depth by gain × the pumping rosette’s wave', () => {
    const s = settings({
      pump: {
        rosette: { radius: 30, wave: { kind: 'sine', lobes: 6, amplitude: 0.02 } },
        rubber: { shape: 'round', radius: 0 },
        gain: 2,
      },
    });
    const path = computeToolpaths(s).passes[0];
    const z = [...path.xyz].filter((_, i) => i % 3 === 2);
    expect(Math.min(...z)).toBeCloseTo(-0.09, 4);
    expect(Math.max(...z)).toBeCloseTo(-0.01, 4);
  });

  it('records the rubber touching where the rosette faces it', () => {
    const path = computeToolpaths(settings()).passes[0];
    const quarter = path.contact.length / 4;
    expect(path.contact[0]).toBeCloseTo(0, 3);
    expect(((path.contact[Math.floor(quarter)] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toBeCloseTo(
      (3 * Math.PI) / 2,
      2,
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/toolpath/toolpath.test.ts` (in `packages/rosee`)
Expected: FAIL — cannot resolve `./toolpath`

- [ ] **Step 3: Write `packages/rosee/src/toolpath/settings.ts`**

```ts
import type { Rubber } from '../contact/table';
import type { Cutter } from '../cutter/cutter';
import type { Job } from '../job/job';
import type { Rosette } from '../rosette/rosette';

/** A pumping rosette and its rubber. `gain` is the lever ratio from the
 *  pumping rubber's travel to the headstock's travel along the spindle. */
export interface Pump {
  rosette: Rosette;
  rubber: Rubber;
  gain: number;
}

/** Everything that decides the cut, as plain data. Lengths in mm, angles in
 *  degrees. `pivotDistance` is how far below the spindle axis the headstock
 *  rocks. */
export interface Settings {
  rosette: Rosette;
  rubber: Rubber;
  pivotDistance: number;
  pump: Pump | null;
  cutter: Cutter;
  job: Job;
  samplesPerTurn: number;
}
```

- [ ] **Step 4: Write `packages/rosee/src/toolpath/toolpath.ts`**

```ts
import { rad, TAU } from '../angle';
import { contactTable, reachAt } from '../contact/table';
import { expandJob, type Pass } from '../job/job';
import { headstockToWork, machineToHeadstock } from '../machine/pose';
import { swingAt, swingTable } from '../machine/swing';
import type { Settings } from './settings';

/** One pass, sampled `samples + 1` times over a full turn (the last sample
 *  repeats the first). Sample i is at spindle angle i / samples · 2π. */
export interface PassPath {
  pass: Pass;
  /** Cutter tip in work coordinates, mm: x, y, z per sample. z is negative
   *  into the stock. */
  xyz: Float32Array;
  /** Headstock swing, radians. */
  swing: Float32Array;
  /** Headstock travel toward the cutter from pumping, mm. */
  pump: Float32Array;
  /** Rosette-local angle at which the rubber touches, radians. */
  contact: Float32Array;
}

export interface Toolpaths {
  samples: number;
  /** Where the rubber sits on the machine's x axis, mm. */
  rubberX: number;
  passes: PassPath[];
}

export function computeToolpaths(s: Settings): Toolpaths {
  const table = contactTable(s.rosette, s.rubber);
  const pumpTable = s.pump ? contactTable(s.pump.rosette, s.pump.rubber) : null;
  const rubberX = table.mean;
  const swings = swingTable(table, rubberX, s.pivotDistance);
  const n = s.samplesPerTurn;
  const passes = expandJob(s.job).map((pass): PassPath => {
    const xyz = new Float32Array((n + 1) * 3);
    const swing = new Float32Array(n + 1);
    const pump = new Float32Array(n + 1);
    const contact = new Float32Array(n + 1);
    const index = rad(pass.index);
    for (let i = 0; i <= n; i++) {
      const spindle = (i / n) * TAU;
      const rosetteAngle = spindle + rad(pass.phase);
      const { swing: sw, contact: touch } = swingAt(swings, rosetteAngle);
      const tip = machineToHeadstock([pass.radius, 0], s.pivotDistance, sw);
      const [x, y] = headstockToWork(tip, spindle, index);
      const travel =
        s.pump && pumpTable
          ? s.pump.gain * (reachAt(pumpTable, -(spindle + rad(pass.pumpPhase))) - pumpTable.mean)
          : 0;
      xyz[i * 3] = x;
      xyz[i * 3 + 1] = y;
      xyz[i * 3 + 2] = -(pass.depth + travel);
      swing[i] = sw;
      pump[i] = travel;
      contact[i] = touch;
    }
    return { pass, xyz, swing, pump, contact };
  });
  return { samples: n, rubberX, passes };
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run src/toolpath/toolpath.test.ts` and `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/rosee/src/toolpath/settings.ts packages/rosee/src/toolpath/toolpath.ts packages/rosee/src/toolpath/toolpath.test.ts
git commit -m "compute toolpaths from the machine settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 10: Presets, SVG export, public index

**Files:**
- Create: `packages/rosee/src/presets.ts`
- Create: `packages/rosee/src/export/svg.ts`
- Create: `packages/rosee/src/export/svg.test.ts`
- Create: `packages/rosee/src/index.ts`

- [ ] **Step 1: Write the failing test** — `packages/rosee/src/export/svg.test.ts`

```ts
import { expect, it } from 'vitest';
import { PRESETS } from '../presets';
import { computeToolpaths } from '../toolpath/toolpath';
import { toolpathsSvg } from './svg';

it('draws one polyline per pass, sized in mm', () => {
  const t = computeToolpaths({ ...PRESETS.swirl, samplesPerTurn: 90 });
  const svg = toolpathsSvg(t);
  expect(svg.match(/<polyline /g)).toHaveLength(t.passes.length);
  expect(svg).toMatch(/width="[\d.]+mm"/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/export/svg.test.ts` (in `packages/rosee`)
Expected: FAIL — cannot resolve `../presets`

- [ ] **Step 3: Write `packages/rosee/src/presets.ts`**

```ts
import type { Settings } from './toolpath/settings';

const base: Settings = {
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1 } },
  rubber: { shape: 'round', radius: 1 },
  pivotDistance: 150,
  pump: null,
  cutter: { vAngle: 110, tipFlat: 0 },
  job: { from: 4, to: 18, step: 0.35, depth: 0.06, phaseStep: 2, phaseGroup: 1, pumpPhaseStep: 0, indexCount: 1 },
  samplesPerTurn: 2048,
};

/** Classic patterns, each one plain settings. Half a lobe of phase is
 *  180 / lobes degrees: 15° on a 12-lobe rosette. */
export const PRESETS = {
  /** A small phase step every pass twists the lobes into a spiral. */
  swirl: base,
  /** Groups of passes in phase, each group half a lobe from the last. */
  basket: { ...base, job: { ...base.job, step: 0.3, phaseStep: 15, phaseGroup: 4 } },
  /** Every pass half a lobe from the last: the lobes interleave into grains. */
  barleycorn: {
    ...base,
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 0.6 } },
    job: { ...base.job, step: 0.25, phaseStep: 7.5, phaseGroup: 1 },
  },
} satisfies Record<string, Settings>;

export type PresetName = keyof typeof PRESETS;
```

- [ ] **Step 4: Write `packages/rosee/src/export/svg.ts`**

```ts
import type { Toolpaths } from '../toolpath/toolpath';

/** The toolpaths as an SVG drawing in mm, one polyline per pass, y up. */
export function toolpathsSvg(t: Toolpaths, strokeWidth = 0.02): string {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of t.passes) {
    for (let i = 0; i < p.xyz.length; i += 3) {
      minX = Math.min(minX, p.xyz[i]);
      maxX = Math.max(maxX, p.xyz[i]);
      minY = Math.min(minY, -p.xyz[i + 1]);
      maxY = Math.max(maxY, -p.xyz[i + 1]);
    }
  }
  const pad = 1;
  const w = maxX - minX + 2 * pad;
  const h = maxY - minY + 2 * pad;
  const lines = t.passes.map((p) => {
    const pts: string[] = [];
    for (let i = 0; i < p.xyz.length; i += 3) pts.push(`${p.xyz[i].toFixed(4)},${(-p.xyz[i + 1]).toFixed(4)}`);
    return `<polyline points="${pts.join(' ')}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" viewBox="${(minX - pad).toFixed(3)} ${(minY - pad).toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}">`,
    `<g fill="none" stroke="black" stroke-width="${strokeWidth}">`,
    ...lines,
    '</g>',
    '</svg>',
  ].join('\n');
}
```

- [ ] **Step 5: Write `packages/rosee/src/index.ts`**

```ts
export { deg, rad, TAU } from './angle';
export { CONTACT_SAMPLES, type ContactTable, contactTable, reachAt, type Rubber } from './contact/table';
export { type Cutter, grooveWidth } from './cutter/cutter';
export { toolpathsSvg } from './export/svg';
export { expandJob, type Job, type Pass } from './job/job';
export { headstockToMachine, headstockToWork, machineToHeadstock, type Vec2, workToHeadstock } from './machine/pose';
export { contactGap, solveSwing } from './machine/swing';
export { choice, type ChoiceParam, num, type NumberParam, type ParamSpec } from './params';
export { PRESETS, type PresetName } from './presets';
export type { ProfilePoint } from './rosette/profile';
export { displacement, radiusAt, type Rosette, WAVE_PARAMS, type Wave, type WaveKind } from './rosette/rosette';
export { flatFace, type Surface } from './surface/surface';
export type { Pump, Settings } from './toolpath/settings';
export { computeToolpaths, type PassPath, type Toolpaths } from './toolpath/toolpath';
```

- [ ] **Step 6: Run it and watch it pass**

Run: `npx vitest run src/export/svg.test.ts` and `npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/rosee/src/presets.ts packages/rosee/src/export/svg.ts packages/rosee/src/export/svg.test.ts packages/rosee/src/index.ts
git commit -m "add presets, SVG export and the public index

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 11: Whole-suite check and build

- [ ] **Step 1: Run the package's tests**

Run: `npm test` (repo root)
Expected: 8 test files, 40 tests, all passing. This suite takes a few seconds, so it
runs locally.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `packages/rosee/dist/index.js` and `index.d.ts`, with no test files in `dist/`.

- [ ] **Step 3: Update the spec's status line**

In `docs/superpowers/specs/2026-10-05-rose-engine-design.md`, change the first
bold line to: `**Status: library built (plan 1); carve and lab not built yet.**`

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-10-05-rose-engine-design.md
git commit -m "mark the rosee library built

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

