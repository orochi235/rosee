# rosee: rose engine lathe simulator — design

**Status: v1 and roadmap items 1–5 built: chucks, equations, surfaces, the
straight-line engine and rosette import. Items 6–10, other engraving machines,
are not started.** This is the design for v1 plus the roadmap after it. It is for whoever implements it; it assumes familiarity with
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
on a flat face, plus eccentric and elliptical [chucks](#chucks) and barrel and
dome [surfaces](#surfaces), and a [straight-line engine](#straight-line-engine).
Roadmap at the end.

## Layout

npm workspaces, following agnew.

```
packages/rosee        library, pure TypeScript, no DOM
  rosette/            rosette definitions (data) → outline radius at angle
  rosette/import/     SVG, DXF and traced-photo outlines → a drawn rosette
  contact/            rubber shape vs rosette outline
  machine/            chuck, headstock pivot, pump slide, phase → work pose at angle
  cutter/             V angle, tip flat, slide-rest position
  job/                program of passes, as data
  toolpath/           job × machine → cutter-tip paths in work coordinates
  surface/            the stock's surface: where the graver sits, and the sheet it unrolls to
  export/             toolpaths → SVG
packages/rosee/gl     subpath export `rosee/gl`: WebGL2 carve, lit sheet, lit part
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

### Rosette import

A rosette can be read from a closed outline: an SVG or DXF drawing, or a photo
or scan. Every source becomes loops in mm, the loop enclosing the most area is
taken as the outline (an arbor hole or a mark inside it is ignored), and
`rosetteFromOutline` turns it into a `drawn` wave, so an imported rosette is
edited, cut and written out as equations like a hand-drawn one:

1. The outline is sampled in 4096 directions round its area centroid, keeping
   the farthest crossing in each. An outline that does not run all the way round
   its centroid is refused.
2. The lobe count is the largest n up to 96 at which folding the outline into n
   repeats leaves an rms residual within 8% of its amplitude; 1 if none does. An
   outline with no measurable wave (a circle's facets) is round.
3. The lobes are averaged into one, box-filtered to 16–256 points, and turned so
   the lobe's peak is at u = 0; the mean radius and amplitude come out in mm.

| Source | Read by | Size |
|---|---|---|
| SVG (`svgLoops`) | paths (every command, arcs included), polygons, polylines, circles, ellipses and rects, with group and element transforms | its own: `width` in mm, in or cm over the `viewBox`, else 96 px to the inch; y flipped up |
| DXF (`dxfLoops`) | LWPOLYLINE and POLYLINE with bulges, CIRCLE, ELLIPSE, SPLINE (de Boor; weights ignored), and LINE, ARC and open polylines chained end to end into loops | `$INSUNITS`, mm when unset |
| Picture (`traceLoops`) | marching squares on brightness at Otsu's threshold, the picture padded with its border's brightness so a shape touching the edge closes | none: scaled to the current mean radius |

The lab's **Import rosette** button, under the Rosette panel, takes any of
them; a picture is traced at up to 1024 px on its longer side.

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

### Straight-line engine

`Settings.engine` is `{ kind: 'rose' }`, or `{ kind: 'straight', stroke }`: a
machine whose work does not turn. A carriage on the rocking frame slides the
work along the frame's y axis, geared to the rosette so it travels `stroke` mm
per rosette turn, centered on the stroke: c(θ) = L(θ/2π − ½). Rocking and
pumping are unchanged, so a lobed rosette moves the work across the stroke as it
slides, and the cutter cuts a straight wave. In the chain the carriage replaces
the spindle's rotation: a headstock-frame tip h maps to the work as
Rot(index)(h − (0, c)) (`headstockToCarriage`). The job's `from`/`to` set the
row across the stroke, phasing shifts the waves along it, and the division plate
turns the work on the carriage, so a second index crosses the rows. The graver's
V opens across the stroke and does not turn. `PassPath.slide` holds the
carriage's travel. A straight-line engine cuts a flat face with no chuck;
`computeToolpaths` refuses either, and the lab's Engine panel takes the chuck off
and flattens the surface when it is chosen, hiding both panels. Switching
engines also moves the rows: radii from–to become rows centered on the stroke,
and back to radii starting at 4 mm. A hash from before engines restores to a
rose engine.

Presets for it, grouped under their own heading in the picker: `ruled` (plain
rows from a round rosette), `waves` (rows in phase), `flame` (a small phase step
slanting the crests), `grain` (barleycorn in rows), `chain` (rows in phase in
groups of four), `scales` (a petal rosette at half a lobe a row) and `lattice`
(waves cut again a quarter turn round on the division plate).

The lab draws the machine as it is. A rack on the carriage meshes with a pinion
on the arbor whose pitch radius is L/2π, so one turn rolls the carriage one
stroke. The carriage runs on rails on the rocking frame, and the work is a
rectangular plate covering the whole cut. The callouts call the spindle the
arbor, and add the carriage and the rack and pinion.

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

`Settings.surface` is the stock the graver works on: `{ kind: 'flat' }`, a
barrel `{ kind: 'cylinder', radius, length }` cut round its side, or a dome
`{ kind: 'dome', radius, rim }`, a cap of a sphere whose pole sits on the
spindle axis at z = 0. A hash from before surfaces restores to `flat`.

The surface does two things, and the kinematic chain is unchanged by it:

- **It places the graver** (`graverAt`). The job's `from`/`to`, and each
  pass's `Pass.at`, measure a radius on a face, the distance from the face along
  a barrel, and the arc from the pole on a dome. The graver points into the
  stock square to the surface, and its V opens across the direction the work
  moves past it:

  | Surface | Tip, machine frame | Points | V opens along |
  |---|---|---|---|
  | flat | (at, 0, −d) | down the spindle | machine x |
  | cylinder | (R − d, 0, −at) | at the axis | the spindle |
  | dome, γ = at/S | ((S − d) sin γ, 0, −S + (S − d) cos γ) | at the sphere's center | the meridian |

  The tip's x and y run back through the chain as before; the pump subtracts
  from its z. On a face that z is depth. On a barrel it is position along the
  barrel, so a barrel's pattern comes from the pump, and rocking, which moves
  the work toward and away from a graver at its side, only changes depth. On a
  dome rocking carries the work sideways under the graver, which off the pole
  changes depth by about the swing's travel times sin γ: the `dome` preset's
  shallow rosette and deep cut keep the graver in the stock.

- **It unrolls the cut onto a sheet** (`toSheet`, inverse `fromSheet`): a
  work-frame point to (u, v) across the sheet and h, the height above the
  uncut surface. A face is its own sheet. A barrel unrolls to u = R·atan2(y, x),
  v = −z, h = √(x² + y²) − R, wrapping at u = ±πR (`sheetPeriod`). A dome maps
  by arc from the pole, keeping the direction round the axis (an azimuthal
  equidistant map), h being the distance from the center less S.

`PassPath.uvh` holds each sample on the sheet, and `PassPath.across` is the
V's opening as an angle on the sheet, found by stepping 1 µm along the
opening in the work and mapping both ends. On a face both are what v1 stored.
Every 2D output reads the sheet: the lines, the SVG export (a pass round a
barrel breaks into two polylines at the seam, `sheetRuns`) and the carve.

## Carve and render (`rosee/gl`)

WebGL2, no three.js. An orthographic camera looks straight down at the sheet. Each
toolpath is drawn as a strip whose cross-section is the cutter's V (and tip flat)
at that sample's depth, into a float depth target with depth test keeping the
deepest cut per pixel; overlapping cuts resolve correctly for free. The V is
built square to the sheet, which on a curved surface is square to the surface
under the graver.

The carve holds a rectangle of the sheet (`CarveMesh.bounds`) in texels that stay
square: `resolution` along the longer side. A face or dome is a square round the
axis; a barrel is its whole circumference by the length cut. A pass is meshed
with u unwrapped, so it runs unbroken past the barrel's seam, and drawn five times
shifted by −2 to +2 periods; the texture clips what falls outside. The shading
pass wraps u the same way. The graver is
fixed to the machine, so the V opens across the machine's x axis carried into the
work (`PassPath.across`), not across the path: a groove narrows where the path
climbs steeply. `createCarve` defaults to 4096², the lab starts at 2048² for
speed; blank stock is at depth 0. A second pass shades from
the depth target: normals from finite differences, a GGX highlight from a movable
light so facets flash as it moves, and a pixel's footprint averaged when it spans
several texels. Carving up to a transport position means drawing passes before the
current one in full and the current one up to θ.

`createPart` draws the carved part in 3D in the same context, with no
readback: a 256² grid over the part's sheet (a face out to the carve, a barrel's
whole length, a dome to its rim) wrapped by `fromSheet` in the vertex shader, and
lit per pixel with normals from the carve's heights carried through the
surface's tangents. The silhouette is the uncut surface; the cut shows in the
light, as an engraved part does at arm's length. The light is fixed to the work,
as in the sheet view. The two shaders share one GLSL source for the heights and
one for the metal.

## Lab

One page; labkit `ControlPanel` on the left (groups: Rosette, Rubber, Headstock,
Pumping, Chuck, Surface, Cutter and job, Look, Presets) and a `WorkspaceGrid`:

- **Output**: Lines / Surface / Split on the sheet, carved to the transport
  position, and Part: the carved part in 3D, drag to turn, wheel to zoom, 0 to
  reset.
- **Mechanism 2D**: tabs Top (rosette, rubber, headstock on its pivot, cutter),
  Side (pump), Contact zoom (rubber on rosette, magnified).
- **Motion plots**: swing angle, pump offset and cutter radius vs spindle angle,
  cursor at the current angle (weasel-ui `Plot2D`).
- **Machine 3D**: crude three.js model (boxes, cylinders, a disc rosette) driven by
  the same per-sample machine state as the 2D views, orbit camera. Its purpose is
  debugging: where it disagrees with the 2D view, one of them has a bug.
  The last turn of cut is drawn on the work's face, fading with age, as cut by
  the magnified swing, so it starts at the drawn graver; at 1× it is the toolpath.
- **Callouts**: hovering a part in the 3D machine or the 2D Top and Contact views
  shows what it is, how it works, and one live value at the playhead (the
  rubber's contact angle, the headstock's swing, the groove's width). A Parts list
  in each tile's corner opens the same callouts by keyboard or touch.
- **Transport**: labkit's `TrialTransport` in the lab's footer: play/pause, loop,
  speed in turns a second, and a scrubber over the whole cut. Each tile is a
  labkit trial playing on the lab's one clock, whose length follows the loaded
  cut at 2 turns a second; each trial's status bar shows pass `n/N` and the
  angle, pinned to a fixed width.

On a straight-line engine the Top view draws the plate on its carriage between
the rails, and the Side view the carriage behind the plate. The 3D machine hangs
each engine's own work-holding off a shared frame: the rose engine's chuck and
round stock, or the straight-line engine's rails, carriage, plate, and rack
and pinion. The motion plots show the cutter across the stroke and the
carriage's travel.

With a chuck fitted, the Top view and the 3D machine draw
the slide on the faceplate with the work offset along it, and the ring for the
elliptical chuck, each with a callout (live value: the slide offset); the motion
plots add the slide offset against spindle angle. Two presets use them:
`wheel` (off-center roses repeated around the eccentric chuck's wheel) and `oval`
(the swirl on an elliptical chuck).

On a barrel or dome, the Side view draws the stock's profile to scale with the
graver set square to it, the 3D machine draws the stock as the solid and the
graver aimed the same way, with the cut laid just proud of the surface; the
motion plots show the graver's place as the surface measures it and the depth
of cut. The job's From and To are labeled by what they measure. Presets
`barrel` (pump waves round a barrel, the depth breathing with a shallow
rosette) and `dome` (a swirl on a dome) use them.

Panes stay under about 400 px tall. All state lives in the URL hash. Presets
are settings objects, grouped in the picker by engine.

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
| Round rosette on a barrel | A ring at v = at, h = −d all the way round |
| Rocking rosette on a barrel | v stays at `at`; h varies |
| Pumping rosette on a barrel | v = at + gain × the pump rosette's wave, h = −d |
| Round rosette on a dome | A ring of arc `at` from the pole, h = −d |
| Any surface | `fromSheet` inverts `toSheet`; the graver sits d below the surface and points square into it |
| Hash from before surfaces | Restores to a face |
| Straight-line engine, round rosette | A straight line at x = at, y running −L/2 to L/2 |
| Straight-line engine, lobed rosette | A wave across the stroke, one lobe every L/n |
| Straight-line engine, index a quarter turn | The rows turned a quarter turn |
| Outline of a 12-lobe sine, or a 7-lobe petal | Read back as 12 or 7 lobes within 0.02 or 0.05 mm |
| Outline of a circle | One lobe, no amplitude |
| SVG in mm with an arbor hole; in px under a group transform; arcs and curves | The rosette at its own size; the hole ignored |
| DXF polyline, circle in inches, bulges, lines and arcs | Read at their size; pieces chained into a loop |
| A soft-edged picture of a rosette | Traced to within 0.04 mm at 5 px/mm |

`npm run smoke` imports an SVG outline and a PNG drawn in the page, and checks
the lab reads a drawn lobe from the SVG and 7 lobes from the PNG.

A browser test carves a ring round a barrel and finds it cut the whole way
across the seam; another draws each curved preset's part and finds it in the
middle of the canvas. The `dome` preset keeps the graver in the stock at every
sample.

The carve gets a headless-Chromium test: one straight groove of known V angle and
depth must measure 2·depth·tan(vAngle/2) wide within one pixel. `npm run smoke`
loads every preset headless and screenshots it.

## Equations

Each stage of a simulation written out as MathML, once in symbols and once with
the current pass's numbers in them, shown in the Motion tile beside the
playhead's values. The equations describe the code rather than run it: tests
evaluate them against the library, so an equation cannot disagree with the cut
without a test failing.

### Library (`math/`)

`expr.ts` is a small expression tree: numbers, settings (which print as a name or
as their number, degrees evaluating in radians), variables, sums, products,
quotients, powers, `cos`, `sin`, `tan`, `sqrt`, `abs`, `min`, `arg`, `mod`, 2D
vectors and rotations, a piecewise node, and a "max over α" node whose body may
carry a condition. An alias prints a short name (u, s, H_φ⁻¹(r_c, 0)) and
evaluates what it stands for; the equation defining it is built from the same
expression, so the two cannot drift. `evaluate(expr, env)` compiles the tree to
closures; `toMathML(expr)` emits MathML Core with text escaped. No TeX step and
no dependency.

"Max over α" samples 4096 angles, bisects to the edge wherever its condition
flips, and closes in on the best sample, so it lands within 2·10⁻⁵ mm of the
contact table, edge contacts with a flat rubber included.

`describe(settings, toolpaths, pass)` returns stages, each a title and its
equations. An equation is a left side, a right side and a kind: a **formula**
can be evaluated; a **definition** is implicit or tabulated and only prints. A
formula holding a drawn lobe becomes a definition, so a drawn rosette makes both
r(α) and R(β) definitions. `sampleEnv` binds the variables at one sample: θ, φ,
the touched angle α, the depth of cut, and the β directions, which it gets by
evaluating their own equations.

| Stage | Equation | Kind | Checked against |
|---|---|---|---|
| Rosette | r(α) = r₀ + Σ A·p(u), u = nα/2π mod 1, p per wave kind: `sine` cos 2πu; `flat`, `petal`, `scallop` in d = min(u, 1 − u) | formula | `radiusAt` |
| Rosette, `drawn` | p is the periodic monotone cubic through the drawn points, shown as a table | definition | — |
| Reach, round ρ | R(β) = max over α with \|r(α) sin(α−β)\| ≤ ρ of r(α) cos(α−β) + √(ρ² − (r(α) sin(α−β))²); R(β) = r(β) for a knife edge | formula | contact table `reach` |
| Reach, flat w | R(β) = max over α with \|r(α) sin(α−β)\| ≤ w/2 of r(α) cos(α−β) | formula | contact table `reach` |
| Swing | H_φ⁻¹(x, y) = Rot(−φ)(x, y + P) − (0, P); ψ(φ) = arg H_φ⁻¹(X, 0); β = ψ(φ) − θ − phase | formula | `machineToHeadstock` |
| Swing | φ = the largest φ with \|H_φ⁻¹(X, 0)\| = R(β) | definition | — |
| Chain | (x, y) = Rot(−wheel)(Rot(index − θ) H_φ⁻¹(r_c, 0) − (s, 0)); s = e, or e cos(θ − index − ring) | formula, given each sample's φ | `PassPath.xyz`, `PassPath.slide` |
| Pump | β_pump = arg H_φ⁻¹(X_pump, 0) − θ − phase_pump; z = −(d₀ + g(R_pump(β_pump) − X_pump)); z = −d₀ with no pump | formula, given R_pump from the table | `PassPath.xyz` z |
| Groove | w = f + 2d tan(V/2) | formula | `grooveWidth` |
| Carriage | c = L(θ/2π − ½); (x, y) = Rot(index)(H_φ⁻¹(r_c, 0) − (0, c)) | formula | `PassPath.slide`, `PassPath.xyz` |
| Sheet, barrel | (u, v, h) = (R_b arg(x, y), −z, \|(x, y)\| − R_b) | formula | `PassPath.uvh` |
| Sheet, dome | (u, v) = S·arg(z + S, \|(x, y)\|)/\|(x, y)\| · (x, y), h = \|(x, y, z + S)\| − S | formula | `PassPath.uvh` |

On a barrel or dome the Chain's tip is the graver's, H_φ⁻¹(R_b − d₀, 0) or
H_φ⁻¹((S − d₀) sin γ, 0) with γ = a/S, and the Depth stage's z is the graver's
z less the pump's travel: −a on a barrel, −S + (S − d₀) cos γ on a dome.

X is where the rubber sits, the reach table's mean (`Toolpaths.rubberX`), and
X_pump the pumping rubber's (`Toolpaths.pumpX`); P the pivot distance; r_c the
pass's cutter radius.

### Lab

The Motion tile has tabs, Plots and Equations. Equations lists the stages top
to bottom, scrolling within the tile, each equation with the playhead's value
in a fixed-width column beside it: r at the contact, R(β), φ, s, the tip, z and
the groove's width. The transport goes down to 64 seconds a turn, slow enough
to follow one turn against the equations.

### Testing

Every formula is evaluated for every preset, every wave kind under knife, round
and flat rubbers, and a pumped elliptical case: the rosette at 360 angles, the
reach at 256 directions, the chain and depth at every fourth sample of the first
and last pass. A formula printing a symbol its environment does not bind fails.
MathML gets a snapshot per preset, and `npm run smoke` opens the Equations tab
and finds `<math>`, values, and no error.

## Roadmap

In order.

1. **Eccentric and elliptical chucks**: built; see [Chucks](#chucks).
2. **The math as equations**: built; see [Equations](#equations).
3. **Surface work**: built; see [Surfaces](#surfaces).
4. **Straight-line engine**: built; see [Straight-line engine](#straight-line-engine).
5. **Rosette import**: built; see [Rosette import](#rosette-import).

Not started; each needs evaluating before it is designed.

6. **Geometric chuck**: a stack of rotating stages geared together, each with
   its own radius and speed ratio, drawing epicycloid figures. It generalizes
   the eccentric chuck, so it may fit the existing chuck chain.
7. **Ornamental turning cutting frames**: the cutter, not the work, runs a
   small loop (eccentric, elliptical or epicycloidal cutting frame), stepped
   round by a division plate. Needs a cutter path in the chain.
8. **Geometric pen**: the geometric chuck's motion drawing with a pen, not a
   cutter. Possibly only an output mode of item 6.
9. **Medal ruling machine**: parallel lines whose wiggles copy a relief, so
   the print looks embossed. Its input is a height map, not a rosette.
10. **Pantograph or reducing machine**: copies a large master down to small
    scale. It copies a pattern instead of generating one, so it may not belong
    here at all.
