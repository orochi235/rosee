/** The unbroken runs of a pass on its sheet, as [first, last] sample
 *  indices: one run, or several where the pass crosses a barrel's seam and
 *  u jumps by a period. `uvh` holds u, v, h per sample; `count` samples are
 *  read. */
export function sheetRuns(uvh: ArrayLike<number>, count: number, period: number): [number, number][] {
  if (count < 1) return [];
  if (!(period > 0)) return [[0, count - 1]];
  const runs: [number, number][] = [];
  let start = 0;
  for (let i = 1; i < count; i++) {
    if (Math.abs(uvh[i * 3] - uvh[(i - 1) * 3]) > period / 2) {
      runs.push([start, i - 1]);
      start = i;
    }
  }
  runs.push([start, count - 1]);
  return runs;
}
