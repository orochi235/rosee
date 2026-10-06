/** A parameter described as plain data, so the lab can build a control for
 *  it without the library knowing about the lab. */
export type ParamSpec = NumberParam | ChoiceParam;

export interface NumberParam {
  type: 'number';
  key: string;
  label: string;
  default: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}

export interface ChoiceParam {
  type: 'choice';
  key: string;
  label: string;
  default: string;
  options: readonly string[];
}

export const num = (
  key: string,
  label: string,
  def: number,
  min: number,
  max: number,
  step: number,
  suffix?: string,
): NumberParam => ({ type: 'number', key, label, default: def, min, max, step, suffix });

export const choice = (key: string, label: string, def: string, options: readonly string[]): ChoiceParam => ({
  type: 'choice',
  key,
  label,
  default: def,
  options,
});
