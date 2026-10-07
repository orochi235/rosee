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

/** A headstock-frame point in the chuck frame, which turns with the spindle
 *  (`spindle` radians) and is set back on the division plate by `index`
 *  radians, so a positive index turns the cut pattern positively. With no
 *  chuck fitted it is the work frame. */
export const headstockToChuck = (p: Vec2, spindle: number, index: number): Vec2 => rotate(p, index - spindle);

/** A chuck-frame point in the headstock frame. */
export const chuckToHeadstock = (p: Vec2, spindle: number, index: number): Vec2 => rotate(p, spindle - index);

/** A chuck-frame point in the work frame. The work sits `slide` mm along the
 *  chuck's slide, turned `wheel` radians on its dividing wheel. */
export const chuckToWork = ([x, y]: Vec2, slide: number, wheel: number): Vec2 => rotate([x - slide, y], -wheel);

/** A work-frame point in the chuck frame. */
export function workToChuck(p: Vec2, slide: number, wheel: number): Vec2 {
  const [x, y] = rotate(p, wheel);
  return [x + slide, y];
}

/** A headstock-frame point in the work frame of a straight-line engine,
 *  whose carriage has slid the work `carriage` mm along y and which sits
 *  turned `index` radians on its division plate. */
export const headstockToCarriage = ([x, y]: Vec2, carriage: number, index: number): Vec2 => rotate([x, y - carriage], index);

/** A straight-line engine's work-frame point in the headstock frame. */
export function carriageToHeadstock(p: Vec2, carriage: number, index: number): Vec2 {
  const [x, y] = rotate(p, -index);
  return [x, y + carriage];
}
