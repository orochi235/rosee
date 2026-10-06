/** The surface being cut. Maps a cutter tip in work coordinates (mm; z
 *  negative into the stock) to the carve domain: (u, v) across the surface
 *  and h, the height relative to the uncut surface. */
export interface Surface {
  kind: string;
  toDomain(x: number, y: number, z: number): [u: number, v: number, h: number];
}

/** Face work: the end face of the stock, cut flat on. */
export const flatFace: Surface = { kind: 'flat', toDomain: (x, y, z) => [x, y, z] };
