export const TAU = Math.PI * 2;

export const rad = (deg: number): number => (deg * Math.PI) / 180;
export const deg = (r: number): number => (r * 180) / Math.PI;

/** Fraction of a turn in [0, 1). */
export const turnFraction = (a: number): number => (((a / TAU) % 1) + 1) % 1;
