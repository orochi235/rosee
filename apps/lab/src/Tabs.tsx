/** A row of tab buttons over a tile's body. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly T[]; value: NoInfer<T>; onChange(tab: NoInfer<T>): void }) {
  return (
    <div className="rs-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t} type="button" role="tab" aria-selected={value === t} onClick={() => onChange(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}
