'use client';

import type { FilterType } from '@/hooks/useCanvasList';

const TABS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Auctioning', value: 'auctioning' },
  { label: 'Settled', value: 'settled' },
];

interface StatusTabsProps {
  current: FilterType;
  onChange: (filter: FilterType) => void;
}

export default function StatusTabs({ current, onChange }: StatusTabsProps) {
  return (
    <div className="flex gap-1">
      {TABS.map((tab) => {
        const isActive = tab.value === current;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`font-body text-sm px-3 py-1.5 border transition-colors ${
              isActive
                ? 'bg-accent/10 text-accent border-accent'
                : 'bg-surface text-text-muted border-grid hover:text-text hover:border-text-muted'
            }`}
            style={{
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'color 0.2s steps(3), border-color 0.2s steps(3), background-color 0.2s steps(3)',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
