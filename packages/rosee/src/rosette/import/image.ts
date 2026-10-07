import type { Vec2 } from '../../machine/pose';

/** A picture as its pixels' brightness, 0 to 255, row by row from the top. */
export interface Gray {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

/** Brightness from RGBA pixels, as a canvas's `ImageData` holds them. */
export function grayOf(width: number, height: number, rgba: ArrayLike<number>): Gray {
  const data = new Float32Array(width * height);
  for (let k = 0; k < data.length; k++) data[k] = 0.2126 * rgba[k * 4] + 0.7152 * rgba[k * 4 + 1] + 0.0722 * rgba[k * 4 + 2];
  return { width, height, data };
}

/** The brightness that best splits the picture in two (Otsu's method). */
export function otsu(g: Gray): number {
  const hist = new Float64Array(256);
  for (let k = 0; k < g.data.length; k++) hist[Math.max(0, Math.min(255, Math.round(g.data[k])))]++;
  const total = g.data.length;
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];
  let below = 0;
  let belowSum = 0;
  let best = 0;
  let threshold = 127.5;
  for (let v = 0; v < 255; v++) {
    below += hist[v];
    if (below === 0) continue;
    const above = total - below;
    if (above === 0) break;
    belowSum += v * hist[v];
    const between = below * above * (belowSum / below - (sum - belowSum) / above) ** 2;
    if (between > best) {
      best = between;
      threshold = v + 0.5;
    }
  }
  return threshold;
}

/** Every closed contour of the picture at brightness `level`, by marching
 *  squares, in pixel units with y up from the bottom row. The picture is
 *  padded with the brightness its border mostly has, so a shape touching
 *  the edge still closes. */
export function traceLoops(g: Gray, level = otsu(g)): Vec2[][] {
  const { width: w, height: h } = g;
  let above = 0;
  let edge = 0;
  for (let x = 0; x < w; x++)
    for (const y of [0, h - 1]) {
      edge++;
      if (g.data[y * w + x] > level) above++;
    }
  for (let y = 0; y < h; y++)
    for (const x of [0, w - 1]) {
      edge++;
      if (g.data[y * w + x] > level) above++;
    }
  const pad = above * 2 > edge ? 255 : 0;
  const W = w + 2;
  const H = h + 2;
  const v = (x: number, y: number) => (x < 1 || y < 1 || x > w || y > h ? pad : g.data[(y - 1) * w + (x - 1)]);
  // Edge ids: horizontal edge from (x, y) to (x+1, y) is 2·(y·W + x); vertical is that + 1.
  const point = (id: number): Vec2 => {
    const cell = id >> 1;
    const [x, y] = [cell % W, Math.floor(cell / W)];
    if ((id & 1) === 0) {
      const a = v(x, y);
      const b = v(x + 1, y);
      return [x + (level - a) / (b - a) - 1, h - (y - 1)];
    }
    const a = v(x, y);
    const b = v(x, y + 1);
    return [x - 1, h - (y + (level - a) / (b - a) - 1)];
  };
  const next = new Map<number, number>();
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const tl = v(x, y) > level ? 1 : 0;
      const tr = v(x + 1, y) > level ? 1 : 0;
      const br = v(x + 1, y + 1) > level ? 1 : 0;
      const bl = v(x, y + 1) > level ? 1 : 0;
      const top = 2 * (y * W + x);
      const bottom = 2 * ((y + 1) * W + x);
      const left = 2 * (y * W + x) + 1;
      const right = 2 * (y * W + x + 1) + 1;
      // Each segment runs with the bright side on its left, so loops chain one way.
      switch (tl | (tr << 1) | (br << 2) | (bl << 3)) {
        case 1: next.set(left, top); break;
        case 2: next.set(top, right); break;
        case 3: next.set(left, right); break;
        case 4: next.set(right, bottom); break;
        case 5: next.set(left, bottom); next.set(right, top); break;
        case 6: next.set(top, bottom); break;
        case 7: next.set(left, bottom); break;
        case 8: next.set(bottom, left); break;
        case 9: next.set(bottom, top); break;
        case 10: next.set(top, left); next.set(bottom, right); break;
        case 11: next.set(bottom, right); break;
        case 12: next.set(right, left); break;
        case 13: next.set(right, top); break;
        case 14: next.set(top, left); break;
      }
    }
  }
  const loops: Vec2[][] = [];
  const seen = new Set<number>();
  for (const startId of next.keys()) {
    if (seen.has(startId)) continue;
    const loop: Vec2[] = [];
    let id: number | undefined = startId;
    while (id !== undefined && !seen.has(id)) {
      seen.add(id);
      loop.push(point(id));
      id = next.get(id);
    }
    if (id === startId && loop.length >= 3) loops.push(loop);
  }
  return loops;
}
