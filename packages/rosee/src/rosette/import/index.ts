import { dxfLoops } from './dxf.js';
import { type Gray, traceLoops } from './image.js';
import { largestLoop, type OutlineOptions, rosetteFromOutline } from './outline.js';
import { svgLoops } from './svg.js';

export type { Gray } from './image.js';
export { grayOf, otsu, traceLoops } from './image.js';
export { largestLoop, loopArea, type OutlineOptions, rosetteFromOutline } from './outline.js';
export { dxfLoops } from './dxf.js';
export { pathLoops, svgLoops } from './svg.js';

/** A rosette from the largest closed outline in an SVG document, at the
 *  document's own size. */
export const rosetteFromSvg = (text: string, o?: OutlineOptions) => rosetteFromOutline(largestLoop(svgLoops(text), 'the SVG'), o);

/** A rosette from the largest closed outline in an ASCII DXF drawing, at the
 *  drawing's own size. */
export const rosetteFromDxf = (text: string, o?: OutlineOptions) => rosetteFromOutline(largestLoop(dxfLoops(text), 'the DXF'), o);

/** A rosette traced from a photo or scan: the largest closed contour where
 *  the picture splits into light and dark. A picture has no size in mm, so
 *  the rosette is scaled to the mean radius given. */
export const rosetteFromImage = (g: Gray, o: OutlineOptions & { radius: number }) =>
  rosetteFromOutline(largestLoop(traceLoops(g), 'the picture'), o);
