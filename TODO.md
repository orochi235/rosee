# TODO

Small known gaps, each found in review and left for later.

- The Top view draws the elliptical chuck's ring at the stock's radius, under the translucent stock, so it
  reads faintly, and picking the ring can win over the work near the work's edge. The 3D machine draws it at
  1.25× the stock; the Top view should match (`apps/lab/src/mechanism/drawTop.ts`, `pickTop.ts`).
- Switching the chuck's kind in the sidebar resets eccentricity and wheel to the new kind's defaults instead
  of carrying them over (`apps/lab/src/panels/chuck.ts`).
- `machinePose` rescans every pass for the largest eccentricity on every playhead tick; compute it once per
  toolpath (`apps/lab/src/mechanism/pose.ts`).
