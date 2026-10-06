# rosee carve and lit surface implementation plan (plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: written 2026-10-05, not started.** Plan 3 (the labkit lab) is not written yet.

**Goal:** `rosee/gl`, a WebGL2 subpath of the library that carves toolpaths into a
height map with the real graver geometry and lights it as polished metal.

**Architecture:** `carveMesh` (pure, Node-tested) sweeps the graver's V profile
along each pass into triangles. `createCarve` draws them from straight above into
a `DEPTH_COMPONENT32F` texture with the depth test keeping the deepest cut per
texel, so overlapping cuts resolve for free; a prefix of each pass's buffer is the
pass cut up to a sample. `createShade` lights the heights into the canvas: normals
from slopes, a GGX highlight from one distant light, and the pixel's footprint
averaged when a pixel spans several texels. Spec:
`docs/superpowers/specs/2026-10-05-rose-engine-design.md`, "Carve and render".

**Tech stack:** WebGL2 (no three.js), Vitest 5 browser mode on Playwright's
headless Chromium for the GL tests, TypeScript 7.

Every code block below has run: the full suite (69 tests, 4 of them in headless
Chromium) passed in a scratch copy, and the presets were rendered and looked at.

## Two decisions made while prototyping

- **The graver doesn't turn with the path.** A rose engine's graver is fixed to
  the machine, so its V opens across the machine's x axis, carried into the work by
  spindle, index and swing. Where the path climbs steeply the groove comes out
  narrower than the cutter's nominal width, as on a real machine. The library
  reports this angle per sample as `PassPath.across` (task 1); the mesh reads it.
- **The presets now cut overlapping grooves.** At their old depth (0.06 mm) the
  grooves were narrower than the step, leaving flat land between them; real
  guilloché leaves none. Task 2 deepens them and pins the rule with a test.

## Conventions

- Run node tests: `npx vitest run --project node src/<path>` in `packages/rosee`.
  Browser tests: `npx vitest run --project browser src/<path>`. Typecheck:
  `npx tsc --noEmit`. Ignore a `command not found: _pw_npm_token` line from npm.
- `*.browser.test.ts` runs in headless Chromium; everything else in Node.
- Test-only helpers live in `src/**/fixtures/` and are excluded from the build.

## File map

```
packages/rosee/
  package.json              + ./gl export, pretest installs headless Chromium, browser devDeps
  vitest.config.ts          node and browser projects
  tsconfig.build.json       excludes src/**/fixtures/**
  src/toolpath/toolpath.ts  + PassPath.across
  src/presets.ts            deeper presets
  src/gl/mesh.ts            carveMesh: graver swept along passes → triangles
  src/gl/program.ts         shader compile/link, fullscreen triangle
  src/gl/carve.ts           createCarve: depth-texture carve, heights() readback
  src/gl/shade.ts           createShade: lit metal, METALS
  src/gl/index.ts           the rosee/gl surface
  src/gl/fixtures/          straightGroove, context
```


### Task 1: Report the graver's orientation per sample

**Files:**
- Modify: `packages/rosee/src/toolpath/toolpath.ts`
- Create: `packages/rosee/src/toolpath/across.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/rosee/src/toolpath/across.test.ts`

```ts
import { expect, it } from 'vitest';
import { TAU } from '../angle';
import { headstockToWork, machineToHeadstock } from '../machine/pose';
import { computeToolpaths } from './toolpath';

it('opens the V along the machine x axis, carried into the work by spindle, index and swing', () => {
  const t = computeToolpaths({
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } },
    rubber: { shape: 'round', radius: 1 },
    pivotDistance: 60,
    pump: null,
    cutter: { vAngle: 90, tipFlat: 0 },
    job: { from: 20, to: 20, step: 1, depth: 0.05, phaseStep: 0, phaseGroup: 1, pumpPhaseStep: 0, indexCount: 3 },
    samplesPerTurn: 360,
  });
  for (const path of t.passes) {
    const index = (path.pass.index * Math.PI) / 180;
    for (let i = 0; i <= t.samples; i += 7) {
      const spindle = (i / t.samples) * TAU;
      const at = (x: number) => headstockToWork(machineToHeadstock([x, 0], 60, path.swing[i]), spindle, index);
      const [x0, y0] = at(20);
      const [x1, y1] = at(21);
      const d = Math.atan2(y1 - y0, x1 - x0) - path.across[i];
      expect(Math.abs(d - TAU * Math.round(d / TAU))).toBeLessThan(1e-5);
    }
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/toolpath/across.test.ts`
Expected: FAIL — `path.across` is undefined.

- [ ] **Step 3: Add `across` to `PassPath`** in `packages/rosee/src/toolpath/toolpath.ts`. After the `steep` field:

```ts
  /** Work-frame angle, radians, of the line the graver's V opens across: the
   *  machine's x axis. The graver is fixed to the machine, so this turns with
   *  the work and the swing, not with the path. */
  across: Float32Array;
```

After `const steep = new Uint8Array(n + 1);`:

```ts
    const across = new Float32Array(n + 1);
```

After `steep[i] = at.steep ? 1 : 0;`:

```ts
      across[i] = index - spindle - sw;
```

And return it: `return { pass, xyz, swing, pump: pumpTravel, contact, steep, across };`

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/rosee/src/toolpath/toolpath.ts packages/rosee/src/toolpath/across.test.ts
git commit -m "report the graver orientation per toolpath sample

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 2: Cut the presets deep enough that grooves overlap

**Files:**
- Modify: `packages/rosee/src/presets.ts`
- Create: `packages/rosee/src/presets.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/rosee/src/presets.test.ts`

```ts
import { expect, it } from 'vitest';
import { grooveWidth } from './cutter/cutter';
import { PRESETS } from './presets';

it('cuts every preset deep enough that its grooves overlap', () => {
  for (const s of Object.values(PRESETS)) expect(grooveWidth(s.cutter, s.job.depth)).toBeGreaterThan(s.job.step);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/presets.test.ts`
Expected: FAIL — swirl's 0.06 mm cut is 0.17 mm wide against a 0.35 mm step.

- [ ] **Step 3: Replace `packages/rosee/src/presets.ts`**

```ts
import type { Settings } from './toolpath/settings';

const base: Settings = {
  rosette: { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1 } },
  rubber: { shape: 'round', radius: 1 },
  pivotDistance: 150,
  pump: null,
  cutter: { vAngle: 110, tipFlat: 0 },
  job: { from: 4, to: 18, step: 0.35, depth: 0.15, phaseStep: 2, phaseGroup: 1, pumpPhaseStep: 0, indexCount: 1 },
  samplesPerTurn: 2048,
};

/** Classic patterns, each one plain settings. Half a lobe of phase is
 *  180 / lobes degrees: 15° on a 12-lobe rosette. Each cuts deep enough that
 *  its grooves overlap, leaving no uncut land between them. */
export const PRESETS = {
  /** A small phase step every pass twists the lobes into a spiral. */
  swirl: base,
  /** Groups of passes in phase, each group half a lobe from the last. */
  basket: { ...base, job: { ...base.job, step: 0.3, depth: 0.12, phaseStep: 15, phaseGroup: 4 } },
  /** Every pass half a lobe from the last: the lobes interleave into grains. */
  barleycorn: {
    ...base,
    rosette: { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 0.6 } },
    job: { ...base.job, step: 0.25, depth: 0.1, phaseStep: 7.5, phaseGroup: 1 },
  },
} satisfies Record<string, Settings>;

export type PresetName = keyof typeof PRESETS;
```

- [ ] **Step 4: Run all tests and watch them pass**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/rosee/src/presets.ts packages/rosee/src/presets.test.ts
git commit -m "deepen the presets so their grooves overlap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 3: Sweep the graver into a mesh

**Files:**
- Create: `packages/rosee/src/gl/fixtures/straightGroove.ts`, `packages/rosee/src/gl/mesh.ts`, `packages/rosee/src/gl/mesh.test.ts`
- Modify: `packages/rosee/tsconfig.build.json`

- [ ] **Step 1: Write the fixture** — `packages/rosee/src/gl/fixtures/straightGroove.ts`

```ts
import type { PassPath, Toolpaths } from '../../toolpath/toolpath';

/** A straight groove along x at depth `depth`, the V opening across y. */
export function straightGroove(depth: number, length = 10, samples = 20): Toolpaths {
  const n = samples + 1;
  const xyz = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) xyz.set([-length / 2 + (length * i) / samples, 0, -depth], i * 3);
  const path: PassPath = {
    pass: { radius: 0, depth, phase: 0, pumpPhase: 0, index: 0 },
    xyz,
    swing: new Float32Array(n),
    pump: new Float32Array(n),
    contact: new Float32Array(n),
    steep: new Uint8Array(n),
    across: new Float32Array(n).fill(Math.PI / 2),
  };
  return { samples, rubberX: 30, passes: [path] };
}
```

- [ ] **Step 2: Keep fixtures out of the build** — `packages/rosee/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "declaration": true, "sourceMap": true },
  "exclude": ["src/**/*.test.ts", "src/**/fixtures/**"]
}
```

- [ ] **Step 3: Write the failing test** — `packages/rosee/src/gl/mesh.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { straightGroove } from './fixtures/straightGroove';
import { carveMesh } from './mesh';

describe('carveMesh', () => {
  it('builds two flank quads per segment for a sharp graver', () => {
    const m = carveMesh(straightGroove(0.1), { vAngle: 90, tipFlat: 0 });
    expect(m.passes[0].vertsPerSegment).toBe(12);
    expect(m.passes[0].vertices.length).toBe(20 * 12 * 3);
  });

  it('adds a tip quad for a graver with a flat', () => {
    expect(carveMesh(straightGroove(0.1), { vAngle: 90, tipFlat: 0.02 }).passes[0].vertsPerSegment).toBe(18);
  });

  it('puts the flanks where the V meets the surface', () => {
    const v = carveMesh(straightGroove(0.1), { vAngle: 90, tipFlat: 0 }).passes[0].vertices;
    const ys = new Set<number>();
    const hs = new Set<number>();
    for (let i = 0; i < v.length; i += 3) {
      ys.add(Math.round(v[i + 1] * 1e6) / 1e6);
      hs.add(Math.round(v[i + 2] * 1e6) / 1e6);
    }
    expect([...ys].sort((a, b) => a - b)).toEqual([-0.1, 0, 0.1]);
    expect([...hs].sort((a, b) => a - b)).toEqual([-0.1, 0]);
  });

  it('sizes the domain to hold every cut and leaves room below the deepest', () => {
    const m = carveMesh(straightGroove(0.1), { vAngle: 90, tipFlat: 0 });
    expect(m.extent).toBeGreaterThan(5);
    expect(m.floor).toBeCloseTo(-0.125, 6);
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npx vitest run src/gl/mesh.test.ts`
Expected: FAIL — cannot resolve `./mesh`.

- [ ] **Step 5: Write `packages/rosee/src/gl/mesh.ts`**

```ts
import { rad } from '../angle';
import type { Cutter } from '../cutter/cutter';
import { flatFace, type Surface } from '../surface/surface';
import type { Toolpaths } from '../toolpath/toolpath';

/** One pass as triangles (u, v, h per vertex, mm), laid out segment by
 *  segment so a prefix of the buffer is the pass cut up to a sample. */
export interface PassMesh {
  vertices: Float32Array;
  vertsPerSegment: number;
}

export interface CarveMesh {
  passes: PassMesh[];
  /** Half-width of the square carve domain, centered on the work axis, mm. */
  extent: number;
  /** The deepest height the carve represents, mm (negative). */
  floor: number;
}

/** The graver swept along each pass. At every sample the cutter is a V
 *  profile across `across`; consecutive profiles are joined by quads, which
 *  is exact for a V moved without turning and close when it turns slowly. */
export function carveMesh(t: Toolpaths, cutter: Cutter, surface: Surface = flatFace): CarveMesh {
  const slope = Math.tan(rad(cutter.vAngle) / 2);
  const flat = cutter.tipFlat / 2;
  const quads = flat > 0 ? 3 : 2;
  const vertsPerSegment = quads * 6;
  let extent = 0;
  let deepest = 0;
  const passes = t.passes.map((p): PassMesh => {
    const n = p.across.length;
    // Per sample, the profile's corners: surface-left, tip-left, tip-right, surface-right.
    const profile = new Float32Array(n * 4 * 3);
    for (let i = 0; i < n; i++) {
      const x = p.xyz[i * 3];
      const y = p.xyz[i * 3 + 1];
      const z = Math.min(p.xyz[i * 3 + 2], 0);
      const ax = Math.cos(p.across[i]);
      const ay = Math.sin(p.across[i]);
      const half = flat - z * slope;
      const corners: [number, number][] = [
        [-half, 0],
        [-flat, z],
        [flat, z],
        [half, 0],
      ];
      corners.forEach(([off, h], k) => {
        const [u, v, hh] = surface.toDomain(x + ax * off, y + ay * off, h);
        profile.set([u, v, hh], (i * 4 + k) * 3);
        extent = Math.max(extent, Math.abs(u), Math.abs(v));
        deepest = Math.min(deepest, hh);
      });
    }
    const pairs: [number, number][] = flat > 0 ? [[0, 1], [1, 2], [2, 3]] : [[0, 1], [2, 3]];
    const vertices = new Float32Array((n - 1) * vertsPerSegment * 3);
    let o = 0;
    const put = (i: number, k: number) => {
      vertices.set(profile.subarray((i * 4 + k) * 3, (i * 4 + k) * 3 + 3), o);
      o += 3;
    };
    for (let i = 0; i < n - 1; i++) {
      for (const [a, b] of pairs) {
        put(i, a);
        put(i, b);
        put(i + 1, a);
        put(i + 1, a);
        put(i, b);
        put(i + 1, b);
      }
    }
    return { vertices, vertsPerSegment };
  });
  return { passes, extent: extent * 1.02 + 0.5, floor: deepest < 0 ? deepest * 1.25 : -1 };
}
```

- [ ] **Step 6: Run it and watch it pass**

Run: `npx vitest run src/gl/mesh.test.ts` and `npx tsc --noEmit`
Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/rosee/tsconfig.build.json packages/rosee/src/gl/fixtures/straightGroove.ts packages/rosee/src/gl/mesh.ts packages/rosee/src/gl/mesh.test.ts
git commit -m "sweep the graver along toolpaths into a carve mesh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 4: Carve into a depth texture, tested in headless Chromium

**Files:**
- Modify: `packages/rosee/package.json`
- Create: `packages/rosee/vitest.config.ts`, `packages/rosee/src/gl/fixtures/context.ts`, `packages/rosee/src/gl/program.ts`, `packages/rosee/src/gl/carve.ts`, `packages/rosee/src/gl/carve.browser.test.ts`

- [ ] **Step 1: Add the browser test dependencies** (repo root)

Run: `npm install -D -w rosee @vitest/browser-playwright@^5.0.1 playwright@^1.63.0`
Expected: both land in `packages/rosee/package.json` under `devDependencies`, not
`dependencies`; `package-lock.json` updates.

- [ ] **Step 2: Add the `./gl` export and a `pretest` that fetches the browser.**
In `packages/rosee/package.json`, `exports` and `scripts` become:

```json
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./gl": { "types": "./dist/gl/index.d.ts", "import": "./dist/gl/index.js" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "pretest": "playwright install chromium-headless-shell",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
```

`pretest` is a no-op (about a second) where the browser is already installed, and
it is what lets a fleet node that has never run the suite run it.

- [ ] **Step 3: Write `packages/rosee/vitest.config.ts`**

```ts
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'node', include: ['src/**/*.test.ts'], exclude: ['src/**/*.browser.test.ts'] } },
      {
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
        },
      },
    ],
  },
});
```

- [ ] **Step 4: Write the context fixture** — `packages/rosee/src/gl/fixtures/context.ts`

```ts
/** A WebGL2 context on a detached canvas. */
export function context(size = 256): WebGL2RenderingContext {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('no WebGL2');
  return gl;
}
```

- [ ] **Step 5: Write the failing test** — `packages/rosee/src/gl/carve.browser.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { grooveWidth } from '../cutter/cutter';
import { PRESETS } from '../presets';
import { computeToolpaths } from '../toolpath/toolpath';
import { createCarve } from './carve';
import { context } from './fixtures/context';
import { straightGroove } from './fixtures/straightGroove';
import { carveMesh } from './mesh';

/** Heights down the column through domain point u, from −v to +v. */
function column(h: Float32Array, resolution: number, extent: number, u: number): Float32Array {
  const x = Math.floor(((u / extent + 1) / 2) * resolution);
  const out = new Float32Array(resolution);
  for (let y = 0; y < resolution; y++) out[y] = h[y * resolution + x];
  return out;
}

describe('createCarve', () => {
  const cutter = { vAngle: 90, tipFlat: 0 };

  it('cuts a straight groove as wide as the cutter at that depth, to within a texel', () => {
    const gl = context();
    const carve = createCarve(gl, 1024);
    carve.load(carveMesh(straightGroove(0.2), cutter));
    carve.carve();
    const h = carve.heights();
    const texel = (2 * carve.extent) / carve.resolution;
    const col = column(h, carve.resolution, carve.extent, 0);
    const cut = col.filter((v) => v < -1e-4).length * texel;
    expect(Math.abs(cut - grooveWidth(cutter, 0.2))).toBeLessThan(1.5 * texel);
    // texel centers can straddle the tip line, missing it by up to half a texel of V
    expect(Math.abs(Math.min(...col) + 0.2)).toBeLessThan(texel);
    expect(gl.getError()).toBe(gl.NO_ERROR);
    carve.dispose();
  });

  it('keeps the deeper cut where two grooves cross', () => {
    const gl = context();
    const carve = createCarve(gl, 512);
    const a = straightGroove(0.1);
    const b = straightGroove(0.2);
    b.passes[0].across.fill(0);
    for (let i = 0; i < b.passes[0].xyz.length; i += 3) {
      const x = b.passes[0].xyz[i];
      b.passes[0].xyz[i] = 0;
      b.passes[0].xyz[i + 1] = x;
    }
    carve.load(carveMesh({ ...a, passes: [a.passes[0], b.passes[0]] }, cutter));
    carve.carve();
    const h = carve.heights();
    const mid = Math.floor(carve.resolution / 2);
    const texel = (2 * carve.extent) / carve.resolution;
    expect(Math.abs(h[mid * carve.resolution + mid] + 0.2)).toBeLessThan(texel);
  });

  it('carves only as far as the progress says', () => {
    const gl = context();
    const carve = createCarve(gl, 512);
    carve.load(carveMesh(straightGroove(0.2), cutter));
    carve.carve({ pass: 0, sample: 10 });
    const h = carve.heights();
    const row = Math.floor(carve.resolution / 2);
    const at = (u: number) => h[row * carve.resolution + Math.floor(((u / carve.extent + 1) / 2) * carve.resolution)];
    expect(at(-2)).toBeLessThan(-0.15);
    expect(at(2)).toBeCloseTo(0, 9);
  });

  it('carves a preset to its pass depth', () => {
    const gl = context();
    const carve = createCarve(gl, 1024);
    const t = computeToolpaths({ ...PRESETS.swirl, samplesPerTurn: 1024 });
    carve.load(carveMesh(t, PRESETS.swirl.cutter));
    carve.carve();
    const h = carve.heights();
    let min = 0;
    let cut = 0;
    for (const v of h) {
      min = Math.min(min, v);
      if (v < -1e-4) cut++;
    }
    expect(min).toBeCloseTo(-PRESETS.swirl.job.depth, 2);
    expect(cut / h.length).toBeGreaterThan(0.05);
  });
});
```

The groove-width and crossing tests allow one texel on the depth because texel
centers can straddle the V's tip line; that is sampling, not a carving error.

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run --project browser`
Expected: FAIL — cannot resolve `./carve`.

- [ ] **Step 7: Write `packages/rosee/src/gl/program.ts`**

```ts
export function compile(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('rosee/gl: could not create a shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`rosee/gl: shader did not compile: ${gl.getShaderInfoLog(shader)}`);
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`rosee/gl: program did not link: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

/** A triangle covering the viewport, drawn with no vertex buffer. */
export const FULLSCREEN_VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;
```

- [ ] **Step 8: Write `packages/rosee/src/gl/carve.ts`**

```ts
import { compile, FULLSCREEN_VERTEX } from './program';
import type { CarveMesh } from './mesh';

/** How far the carve has got: every pass before `pass` in full, and `pass`
 *  itself up to sample `sample`. */
export interface CarveProgress {
  pass: number;
  sample: number;
}

export interface Carve {
  readonly resolution: number;
  /** Heights as depth: 1 is the uncut surface, 0 is the mesh's floor. */
  readonly depth: WebGLTexture;
  readonly extent: number;
  readonly floor: number;
  load(mesh: CarveMesh): void;
  carve(upTo?: CarveProgress): void;
  /** Heights in mm, row by row from the domain's −v edge; for tests and export. */
  heights(): Float32Array;
  dispose(): void;
}

const CARVE_VERTEX = `#version 300 es
in vec3 position;
uniform float extent;
uniform float floor_;
void main() {
  gl_Position = vec4(position.xy / extent, 1.0 - 2.0 * position.z / floor_, 1.0);
}`;

const CARVE_FRAGMENT = `#version 300 es
void main() {}`;

const READ_FRAGMENT = `#version 300 es
precision highp float;
uniform highp sampler2D depth;
uniform float floor_;
out vec4 height;
void main() {
  float d = texelFetch(depth, ivec2(gl_FragCoord.xy), 0).r;
  height = vec4(floor_ * (1.0 - d), 0.0, 0.0, 1.0);
}`;

/** Carves toolpath meshes into a depth texture: an orthographic view straight
 *  down onto the work, where the depth test keeps the deepest cut per texel. */
export function createCarve(gl: WebGL2RenderingContext, resolution = 4096): Carve {
  const carveProgram = compile(gl, CARVE_VERTEX, CARVE_FRAGMENT);
  const readProgram = compile(gl, FULLSCREEN_VERTEX, READ_FRAGMENT);
  const depth = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, depth);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, resolution, resolution);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const vao = gl.createVertexArray();
  const positionAt = gl.getAttribLocation(carveProgram, 'position');
  let buffers: { buffer: WebGLBuffer; count: number; perSegment: number }[] = [];
  let extent = 1;
  let floor = -1;

  const carve: Carve = {
    resolution,
    depth,
    get extent() {
      return extent;
    },
    get floor() {
      return floor;
    },
    load(mesh) {
      for (const b of buffers) gl.deleteBuffer(b.buffer);
      buffers = mesh.passes.map((p) => {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, p.vertices, gl.STATIC_DRAW);
        return { buffer, count: p.vertices.length / 3, perSegment: p.vertsPerSegment };
      });
      extent = mesh.extent;
      floor = mesh.floor;
    },
    carve(upTo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, resolution, resolution);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.clearDepth(1);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(carveProgram);
      gl.uniform1f(gl.getUniformLocation(carveProgram, 'extent'), extent);
      gl.uniform1f(gl.getUniformLocation(carveProgram, 'floor_'), floor);
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(positionAt);
      const last = upTo ? Math.min(upTo.pass, buffers.length - 1) : buffers.length - 1;
      for (let k = 0; k <= last; k++) {
        const b = buffers[k];
        const count = upTo && k === upTo.pass ? Math.min(b.count, upTo.sample * b.perSegment) : b.count;
        if (count === 0) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
        gl.vertexAttribPointer(positionAt, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, count);
      }
      gl.bindVertexArray(null);
      gl.disable(gl.DEPTH_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    heights() {
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('rosee/gl: heights() needs EXT_color_buffer_float');
      const target = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, resolution, resolution);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
      gl.viewport(0, 0, resolution, resolution);
      gl.useProgram(readProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, depth);
      gl.uniform1i(gl.getUniformLocation(readProgram, 'depth'), 0);
      gl.uniform1f(gl.getUniformLocation(readProgram, 'floor_'), floor);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const rgba = new Float32Array(resolution * resolution * 4);
      gl.readPixels(0, 0, resolution, resolution, gl.RGBA, gl.FLOAT, rgba);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(target);
      const out = new Float32Array(resolution * resolution);
      for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4];
      return out;
    },
    dispose() {
      for (const b of buffers) gl.deleteBuffer(b.buffer);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(depth);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(carveProgram);
      gl.deleteProgram(readProgram);
    },
  };
  return carve;
}
```

- [ ] **Step 9: Run it and watch it pass**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: node and browser projects both pass (the browser project: 4 tests).

- [ ] **Step 10: Commit**

```bash
git add package-lock.json packages/rosee/package.json packages/rosee/vitest.config.ts packages/rosee/src/gl/fixtures/context.ts packages/rosee/src/gl/program.ts packages/rosee/src/gl/carve.ts packages/rosee/src/gl/carve.browser.test.ts
git commit -m "carve toolpath meshes into a depth texture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 5: Light the carve as metal

**Files:**
- Create: `packages/rosee/src/gl/shade.ts`, `packages/rosee/src/gl/shade.browser.test.ts`, `packages/rosee/src/gl/index.ts`

- [ ] **Step 1: Write the failing test** — `packages/rosee/src/gl/shade.browser.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createCarve } from './carve';
import { context } from './fixtures/context';
import { straightGroove } from './fixtures/straightGroove';
import { carveMesh } from './mesh';
import { createShade, METALS } from './shade';

describe('createShade', () => {
  it('lights a groove differently from the uncut surface', () => {
    const gl = context(256);
    const carve = createCarve(gl, 512);
    carve.load(carveMesh(straightGroove(0.2), { vAngle: 90, tipFlat: 0 }));
    carve.carve();
    const shade = createShade(gl);
    // a low light: its half vector sits near the 45° flank's normal and far from the flat's
    shade.render(carve, { center: [0, 0], mmPerPixel: 0.01 }, { azimuth: 90, elevation: 20 }, METALS.silver);
    const px = new Uint8Array(4 * 256 * 256);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const at = (x: number, y: number) => px[(y * 256 + x) * 4];
    expect(gl.getError()).toBe(gl.NO_ERROR);
    // the groove's flank facing the light is brighter than the flat stock beside it
    const flank = Math.max(at(128, 120), at(128, 136));
    expect(flank).toBeGreaterThan(at(128, 10) + 20);
  });
});
```

The light sits low on purpose: at 45° elevation a 90° V's flank and the flat stock
are equally far from the half vector and shade the same.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project browser src/gl/shade.browser.test.ts`
Expected: FAIL — cannot resolve `./shade`.

- [ ] **Step 3: Write `packages/rosee/src/gl/shade.ts`**

```ts
import type { Carve } from './carve';
import { compile, FULLSCREEN_VERTEX } from './program';

/** Which part of the work the canvas shows: the domain point at the canvas's
 *  center, and the size of a canvas pixel, both in mm. */
export interface View {
  center: [number, number];
  mmPerPixel: number;
}

/** A light far away: azimuth around the work and elevation above it, degrees. */
export interface Light {
  azimuth: number;
  elevation: number;
}

/** Linear RGB in [0, 1], and roughness in (0, 1]: low is a mirror polish. */
export interface Metal {
  color: [number, number, number];
  roughness: number;
}

export const METALS = {
  silver: { color: [0.95, 0.93, 0.88], roughness: 0.3 },
  gold: { color: [1.0, 0.78, 0.34], roughness: 0.3 },
  steel: { color: [0.56, 0.57, 0.58], roughness: 0.4 },
} satisfies Record<string, Metal>;

const SHADE_FRAGMENT = `#version 300 es
precision highp float;
uniform highp sampler2D depth;
uniform float floor_;
uniform float extent;
uniform float resolution;
uniform vec2 center;
uniform float mmPerPixel;
uniform vec2 canvas;
uniform vec3 light;
uniform vec3 metal;
uniform float roughness;
uniform vec3 background;
out vec4 color;

float heightAt(ivec2 t) {
  ivec2 c = clamp(t, ivec2(0), ivec2(int(resolution) - 1));
  return floor_ * (1.0 - texelFetch(depth, c, 0).r);
}

vec3 shadeAt(vec2 mm) {
  vec2 uv = (mm / extent + 1.0) * 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThanEqual(uv, vec2(1.0)))) return background;
  ivec2 t = ivec2(uv * resolution);
  float texel = 2.0 * extent / resolution;
  float dx = (heightAt(t + ivec2(1, 0)) - heightAt(t - ivec2(1, 0))) / (2.0 * texel);
  float dy = (heightAt(t + ivec2(0, 1)) - heightAt(t - ivec2(0, 1))) / (2.0 * texel);
  vec3 n = normalize(vec3(-dx, -dy, 1.0));
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 h = normalize(light + v);
  float a2 = roughness * roughness * roughness * roughness;
  float nh = max(dot(n, h), 0.0);
  float d = a2 / (3.14159265 * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
  float nl = max(dot(n, light), 0.0);
  vec3 fresnel = metal + (1.0 - metal) * pow(1.0 - max(dot(h, v), 0.0), 5.0);
  // a dim sky reflected by every facet, so the stock reads as metal away from the highlight
  return metal * (0.12 + 0.18 * n.z * n.z) + fresnel * d * nl * 0.5;
}

void main() {
  // average the pixel's footprint: a pixel wider than a texel sees many facets at once
  float texel = 2.0 * extent / resolution;
  int k = int(clamp(ceil(mmPerPixel / texel), 1.0, 6.0));
  vec3 sum = vec3(0.0);
  for (int j = 0; j < k; j++) {
    for (int i = 0; i < k; i++) {
      vec2 sub = (vec2(float(i), float(j)) + 0.5) / float(k) - 0.5;
      sum += shadeAt(center + (gl_FragCoord.xy + sub - 0.5 * canvas) * mmPerPixel);
    }
  }
  vec3 lit = sum / float(k * k);
  color = vec4(pow(lit / (1.0 + lit), vec3(1.0 / 2.2)), 1.0);
}`;

export interface Shade {
  render(carve: Carve, view: View, light: Light, metal: Metal, background?: [number, number, number]): void;
  dispose(): void;
}

/** Lights the carved heights as polished metal into the default framebuffer:
 *  normals from the heights' slopes, a GGX highlight from one distant light. */
export function createShade(gl: WebGL2RenderingContext): Shade {
  const program = compile(gl, FULLSCREEN_VERTEX, SHADE_FRAGMENT);
  const u = (name: string) => gl.getUniformLocation(program, name);
  return {
    render(carve, view, light, metal, background = [0.1, 0.1, 0.11]) {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const az = (light.azimuth * Math.PI) / 180;
      const el = (light.elevation * Math.PI) / 180;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, carve.depth);
      gl.uniform1i(u('depth'), 0);
      gl.uniform1f(u('floor_'), carve.floor);
      gl.uniform1f(u('extent'), carve.extent);
      gl.uniform1f(u('resolution'), carve.resolution);
      gl.uniform2f(u('center'), view.center[0], view.center[1]);
      gl.uniform1f(u('mmPerPixel'), view.mmPerPixel);
      gl.uniform2f(u('canvas'), w, h);
      gl.uniform3f(u('light'), Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
      gl.uniform3f(u('metal'), ...metal.color);
      gl.uniform1f(u('roughness'), metal.roughness);
      gl.uniform3f(u('background'), ...background);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
```

- [ ] **Step 4: Write `packages/rosee/src/gl/index.ts`**

```ts
export { type Carve, type CarveProgress, createCarve } from './carve';
export { type CarveMesh, carveMesh, type PassMesh } from './mesh';
export { createShade, type Light, METALS, type Metal, type Shade, type View } from './shade';
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/rosee/src/gl/shade.ts packages/rosee/src/gl/shade.browser.test.ts packages/rosee/src/gl/index.ts
git commit -m "light the carved surface as polished metal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 6: Whole-suite check, build and status

- [ ] **Step 1: Run the suite and build**

Run: `npm test` then `npm run build` (repo root)
Expected: 13 test files, 69 tests passing; `packages/rosee/dist/gl/` holds
`carve`, `mesh`, `program`, `shade` and `index`, and no `fixtures/`.

- [ ] **Step 2: Update the spec's status line**

In `docs/superpowers/specs/2026-10-05-rose-engine-design.md`, the first bold line
becomes: `**Status: library and carve built (plans 1–2); lab not built yet.**`

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-05-rose-engine-design.md
git commit -m "mark the rosee carve built

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

