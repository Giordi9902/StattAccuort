import { useTranslation } from 'react-i18next';

import { formatCount } from './admin-format';

type RankedBarsProps = {
  items: { id: string; name: string; count: number }[];
  emptyLabel: string;
};

// Bars share one scale (the leader is full width), with the value at the tip.
export function RankedBars({ items, emptyLabel }: RankedBarsProps) {
  const { i18n } = useTranslation();
  const max = Math.max(1, ...items.map((item) => item.count));

  if (items.length === 0) return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;

  return (
    <ol className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1" title={`${item.name}: ${item.count}`}>
          <span className="truncate text-sm">{item.name}</span>
          <div className="flex items-center gap-2">
            <div
              className="bg-muted-foreground/65 h-2 rounded-r-[4px]"
              style={{ width: `${(item.count / max) * 85}%`, minWidth: 2 }}
            />
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatCount(item.count, i18n.language)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
