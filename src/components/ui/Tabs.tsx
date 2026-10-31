export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border px-5">
      {tabs.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            onClick={() => onChange(t.id)}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] transition ${
              selected ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
