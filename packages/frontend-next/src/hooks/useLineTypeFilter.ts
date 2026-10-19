import { useSyncExternalStore } from 'react';

import { LINE_TYPE_PRIORITY, type LineType } from '@/api/transit';
import { safeLocalStorage } from '@/lib/safe-storage';

// Which line types the map draws. Shared between the filter menu (mounted in the map route) and the
// layers (inside the lazily-loaded map), so like useRiskLayer it lives in a tiny module store.
// Stores the hidden types, so a type the city gains later shows by default.
const STORAGE_KEY = 'hiddenLineTypes';

function isLineType(value: unknown): value is LineType {
  return typeof value === 'string' && value in LINE_TYPE_PRIORITY;
}

function readInitial(): ReadonlySet<LineType> {
  try {
    const parsed: unknown = JSON.parse(safeLocalStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter(isLineType) : []);
  } catch {
    return new Set();
  }
}

let hiddenTypes = readInitial();
const listeners = new Set<() => void>();

function setHiddenTypes(next: ReadonlySet<LineType>) {
  hiddenTypes = next;
  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLineTypeFilter(): {
  hiddenTypes: ReadonlySet<LineType>;
  toggle: (type: LineType) => void;
} {
  const current = useSyncExternalStore(subscribe, () => hiddenTypes);
  return {
    hiddenTypes: current,
    toggle: (type) => {
      const next = new Set(hiddenTypes);
      if (!next.delete(type)) next.add(type);
      setHiddenTypes(next);
    },
  };
}
