import { useSyncExternalStore } from 'react';

import { RISK_FACTORS, type RiskFactor } from '@/api/risk';
import { safeLocalStorage } from '@/lib/safe-storage';

// Which factors the risk layer combines. A module store like useLineTypeFilter, for the same
// reason: the menu and the layer sit on either side of the lazy map boundary. Stores the hidden
// factors, so a factor added later is on by default.
const STORAGE_KEY = 'hiddenRiskFactors';

function readInitial(): ReadonlySet<RiskFactor> {
  try {
    const parsed: unknown = JSON.parse(safeLocalStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is RiskFactor =>
            (RISK_FACTORS as readonly unknown[]).includes(value),
          )
        : [],
    );
  } catch {
    return new Set();
  }
}

let hiddenFactors = readInitial();
const listeners = new Set<() => void>();

function setHiddenFactors(next: ReadonlySet<RiskFactor>) {
  hiddenFactors = next;
  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRiskFactors(): {
  hiddenFactors: ReadonlySet<RiskFactor>;
  toggle: (factor: RiskFactor) => void;
} {
  const current = useSyncExternalStore(subscribe, () => hiddenFactors);
  return {
    hiddenFactors: current,
    toggle: (factor) => {
      const next = new Set(hiddenFactors);
      if (!next.delete(factor)) next.add(factor);
      setHiddenFactors(next);
    },
  };
}
