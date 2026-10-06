import { f, type ResolvedConfig } from '@weasel-js/labkit';
import type { ParamSpec } from 'rosee';

/** One sidebar section: a labkit schema over a flat config, and the two
 *  mappings between that config and the lab state. */
export interface Panel<T> {
  title: string;
  schema: ResolvedConfig;
  read(from: T): Record<string, unknown>;
  write(to: T, config: Record<string, unknown>): T;
}

export const num = (s: ParamSpec & { type: 'number' }) => {
  const node = f.number(s.default).range(s.min, s.max).step(s.step).label(s.label).manual();
  return s.suffix ? node.suffix(s.suffix) : node;
};
