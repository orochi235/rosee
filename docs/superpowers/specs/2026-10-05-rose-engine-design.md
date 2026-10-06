# rosee: rose engine lathe simulator — design

**Status: v1 and chucks (roadmap item 1) built; the rest of the roadmap is not started.** This is the design for v1 plus the roadmap after it. It is for whoever implements it; it assumes familiarity with
TypeScript and labkit (`@weasel-js/labkit`), not with ornamental turning.

## What it is

A simulator of a rose engine lathe that produces the guilloché a real one would
cut, by modeling the mechanism rather than drawing the pattern. Two outputs from
one model: the cutter-tip **toolpaths** (vector lines, SVG export) and an
**engraved surface** carved from them with a V cutter and lit so the facets catch
light. The mechanism is shown alongside, both as 2D diagrams and a crude 3D model,
so a wrong cut can be traced to the part that caused it.

### The machine, briefly

The work is held on a spindle in a **headstock**. On the same spindle sits a
**rosette**: a cam whose outline has lobes. A fixed **rubber** (follower) presses
against the rosette, and a spring keeps it in contact, so as the spindle turns the
headstock **rocks** on a pivot below it, moving the work sideways past a fixed
**cutter**. A second rosette and rubber can make the headstock **pump**: slide
along the spindle axis, which changes cut depth. Between passes the operator moves
the cutter in radially, and may **phase** the rosette against the work (turn one
relative to the other) or **index** the work by a division plate. A V cutter cuts
a groove whose width is set by its depth, so pumping is visible as grooves
widening and narrowing.

## Scope

v1 models rocking, pumping, phasing and indexing, rubber shape and pivot geometry,
on a flat face, plus eccentric and elliptical [chucks](#chucks). Roadmap at the
end.

## Layout

npm workspaces, following agnew.

```
packages/rosee        library, pure TypeScript, no DOM
  rosette/            rosette definitions (data) → outline radius at angle
  contact/            rubber shape vs rosette outline
  machine/            chuck, headstock pivot, pump slide, phase → work pose at angle
  cutter/             V angle, tip flat, slide-rest position
  job/                program of passes, as data
  toolpath/           job × machine → cutter-tip paths in work coordinates
  surface/            the surface being cut (flat face in v1)
  export/             toolpaths → SVG
packages/rosee/gl     subpath export `rosee/gl`: WebGL2 carve + lit-surface shader
apps/lab              Vite + React on @weasel-js/labkit, port 5197, host '::'
```

Units are millimeters and degrees throughout, so settings read like a real
machine's.

## Data flow

```
settings (URL hash) ─▶ toolpaths ─┬▶ Output: lines / SVG
                                  ├▶ rosee/gl carve ─▶ lit surface
                                  ├▶ Mechanism 2D + motion plots
                                  └▶ Machine 3D
```

Settings are one plain-data object. `computeToolpaths(settings)` is a pure function
returning, per pass, a `Float32Array` of `(x, y, z)` cutter-tip positions in work
coordinates plus the per-sample machine state (swing angle, pump offset, contact
point) that the mechanism views draw from. Every view reads that result; none
recomputes kinematics.

A job is refused past 1,000,000 samples (passes × samples per turn), which keeps
its carve mesh near 200 MB.

Settings are immutable: replace an object to change it. The library caches lobe
profiles per wave object, so a wave edited in place would keep its old shape.

## Library

### Rosettes

A rosette is data: `{ radius, wave }`, a wave of lobes around a mean radius.
Wave kinds: `sine`, `flat` (flat top and floor joined by ramps), `petal` (pointed
peaks), `scallop` (outward arcs meeting in inward cusps), `drawn` (one lobe's
profile as control points from weasel-ui's `CurveEditor`, joined by a periodic
spline and repeated `lobes` times), and `compound` (the sum of child waves). Each
kind declares its params as data so the lab builds panels from them. Contact
samples any rosette into a dense outline polygon, so every kind gets the same
contact treatment.

### Contact and the swing solve

The rosette rides on the spindle, so it moves with the headstock; the rubber is
fixed to the bed. At spindle angle θ the headstock swing angle φ is the one at
which the rubber just touches the rosette outline: rotate the outline by θ + phase,
place it by the headstock pose for φ, and find the φ where the minimum signed
gap between rubber and outline is zero. Where a rosette's wall is steeper than
the headstock's arc, several swings satisfy that; the spring pushes the rosette
onto the rubber from the far side, so the headstock rests at the largest. Those
samples are flagged *steep*: a real machine jumps there, and the lab shows it.
Rubber shapes: round of radius ρ (ρ = 0 is a knife edge) and flat, a face square
to the line of approach. Contact is precomputed as a *reach table*: for each
direction around the rosette, how far out the rubber stops, tested against the
outline's segments rather than its vertices. A rubber too large for a valley never
reaches its floor, and a short pivot arm makes the work travel on an arc; both fall
out without being special-cased.

Known approximation: a flat rubber's face is fixed to the bed, so under swing it
tilts by the swing angle relative to the rosette; the reach table keeps it square
to the line of approach. The error is about 0.001–0.002 mm at pivot distances of
60–150 mm.

The swing depends only on the rosette's angle, not on the cutter or the work, so
it is solved once per rosette angle into a *swing table* that every pass reads.
A preset computes in about 100 ms.

Pumping uses the same reach table on a pumping rosette with its own rubber; a
lever of ratio `gain` turns the rubber's travel into the headstock's travel along
the spindle. Output is the pump offset at θ.

### Machine and cutter

The machine is a chain of motion steps, each mapping a point from work frame to
machine frame at angle θ: chuck, spindle rotation (with the division plate's
index), swing about the pivot, pump slide. The cutter tip is fixed in the machine
frame at (slide radius, 0, depth), on center height; its position in the work
frame is the tip run back through the chain in reverse.

### Chucks

`Settings.chuck` is `null` (work on the faceplate) or one
of:

- `{ kind: 'eccentric', eccentricity, wheel }`: a slide on the faceplate holds the
  work `eccentricity` mm off the spindle axis, and a dividing wheel on the slide
  turns it by `wheel`°. Fixed for the whole turn.
- `{ kind: 'elliptical', eccentricity, ring, wheel }`: a ring bolted to the
  headstock, set `eccentricity` mm off the spindle axis toward angle `ring`°,
  drives the slide as the spindle turns. Fixed per pass except the slide.

The chuck sits after the division plate, so indexing turns the whole chuck. Let
α = spindle − index be the chuck slide's direction in the headstock frame. The
slide offset is s = e for the eccentric chuck and s = e·cos(α − ring) for the
elliptical one (the ring center projected onto the slide). A work point p maps to
the chuck frame as rot(wheel)·p + (s, 0), and from there to the headstock frame by
the existing spindle rotation. With a round rosette, no swing, wheel and ring at
0, a cutter at radius r cuts a circle of radius r centered e off the spindle
(eccentric), or an ellipse with semi-axes |r − e| along the slide and r across it
(elliptical); at r = 0 the elliptical chuck cuts a straight line 2e long.

The chuck never touches a rosette, so the reach and swing tables are unchanged;
`toolpath.ts` runs each tip from the headstock to the chuck frame
(`headstockToChuck`, the work frame when no chuck is fitted) and on to the work
(`chuckToWork`). The graver's `across` angle loses the wheel:
`index − spindle − swing − wheel`. `PassPath` gains `slide` (s per sample, mm)
for the views, so none recomputes it.

The cutter is `{ vAngle, tipFlat }`. It doesn't affect the toolpath, only the
carve.

### Jobs

A job is a program the lab edits: the cutter steps from one radius to another;
every `phaseGroup` passes the rosette is phased on by `phaseStep`, the pump by
`pumpPhaseStep` every pass; the sweep repeats at `indexCount` divisions. It
expands to passes `{ radius, depth, phase, pumpPhase, index }`. One program covers
the swirl (small phase step), barleycorn (half a lobe every pass) and basket weave
(half a lobe every group).

For the chuck, the job gains `wheelCount`, which repeats
the sweep at that many even turns of the chuck's wheel (nested inside
`indexCount`), and `eccentricityStep`, mm added to the chuck's eccentricity every
pass. Passes gain `wheel` and `eccentricity`, each added to the chuck's own
setting. Their defaults (1 and 0) leave every existing job and hash cutting what
it cut before. With `chuck: null`, `computeToolpaths` refuses a job whose
`wheelCount` isn't 1 or whose `eccentricityStep` isn't 0; the lab hides those
fields without a chuck and resets them when the chuck is removed.

### Surfaces

`Surface` maps work coordinates to the 2D carve domain. v1 has `flatFace`
(identity onto the face plane). It exists in v1 so cylinders and domes plug in
without touching the carve.

## Carve and render (`rosee/gl`)

WebGL2, no three.js. An orthographic camera looks straight down at the face. Each
toolpath is drawn as a strip whose cross-section is the cutter's V (and tip flat)
at that sample's depth, into a float depth target with depth test keeping the
deepest cut per pixel; overlapping cuts resolve correctly for free. The graver is
fixed to the machine, so the V opens across the machine's x axis carried into the
work (`PassPath.across`), not across the path: a groove narrows where the path
climbs steeply. `createCarve` defaults to 4096², the lab starts at 2048² for
speed; blank stock is at depth 0. A second pass shades from
the depth target: normals from finite differences, a GGX highlight from a movable
light so facets flash as it moves, and a pixel's footprint averaged when it spans
several texels. Carving up to a transport position means drawing passes before the
current one in full and the current one up to θ.

## Lab

One page; labkit `ControlPanel` on the left (groups: Rosette, Rubber, Headstock,
Pumping, Chuck, Cutter, Job, Surface, Presets) and a `WorkspaceGrid`:

- **Output**: Lines / Surface / Split, carved to the transport position.
- **Mechanism 2D**: tabs Top (rosette, rubber, headstock on its pivot, cutter),
  Side (pump), Contact zoom (rubber on rosette, magnified).
- **Motion plots**: swing angle, pump offset and cutter radius vs spindle angle,
  cursor at the current angle (weasel-ui `Plot2D`).
- **Machine 3D**: crude three.js model (boxes, cylinders, a disc rosette) driven by
  the same per-sample machine state as the 2D views, orbit camera. Its purpose is
  debugging: where it disagrees with the 2D view, one of them has a bug.
- **Callouts**: hovering a part in the 3D machine or the 2D Top and Contact views
  shows what it is, how it works, and one live value at the playhead (the
  rubber's contact angle, the headstock's swing, the groove's width). A Parts list
  in each tile's corner opens the same callouts by keyboard or touch.
- **Transport**: play/pause, pass `n/N`, scrubber, speed; the angle readout pinned
  to a fixed width.

With a chuck fitted, the Top view and the 3D machine draw
the slide on the faceplate with the work offset along it, and the ring for the
elliptical chuck, each with a callout (live value: the slide offset); the motion
plots add the slide offset against spindle angle. Two presets use them:
`wheel` (off-center roses repeated around the eccentric chuck's wheel) and `oval`
(the swirl on an elliptical chuck).

Panes stay under about 400 px tall. All state lives in the URL hash. Presets
(phased swirl, basket weave, barleycorn, wheel, oval) are settings objects.

## Testing

Vitest in Node for the library, against cases with known answers:

| Case | Expected |
|---|---|
| Round rosette, any rubber | Exact circle |
| Sine rosette, ρ → 0, pivot arm → ∞ | r = R + a·cos(nθ) |
| ρ larger than a valley's curvature | Path bridges the valley |
| Short pivot arm | Arc distortion matches hand-derived geometry |
| Pumping rosette | z = −(depth + gain × the pump rosette's wave), deeper on a pump lobe |
| Phase step of one full lobe | Same path as phase 0 |
| Eccentric chuck, round rosette | Circle of radius r centered e off the spindle |
| Elliptical chuck, round rosette | Ellipse with semi-axes \|r − e\| and r; a line 2e long at r = 0 |
| Wheel turned 360° | Same path as wheel 0 |
| `wheelCount` n | Each wheel position's paths are the first's rotated about the chuck slide |
| Hash from before chucks | Restores to `chuck: null`, `wheelCount` 1, `eccentricityStep` 0 |

The carve gets a headless-Chromium test: one straight groove of known V angle and
depth must measure 2·depth·tan(vAngle/2) wide within one pixel. `npm run smoke`
loads every preset headless and screenshots it.

## Roadmap

In order.

1. **Eccentric and elliptical chucks**: built; see [Chucks](#chucks).
2. **The math as equations**: each stage of a simulation written out as MathML with
   the settings' numbers in it: rosette outline, reach and swing as definitions,
   the motion chain as composed transforms. Each stage is an expression tree that
   both prints and evaluates, and a test checks the evaluation against
   `computeToolpaths`, so an equation can't disagree with the code.
3. **Surface work**: cylinder and dome `Surface`s; the carve target becomes the
   unrolled surface, and the 3D view shows the curved part.
4. **Straight-line engine**: a second machine whose chain has a linear slide where
   spindle rotation was; same cutter, job, surface and carve.
5. **Rosette import**: outlines from DXF/SVG, or traced from a photo.
