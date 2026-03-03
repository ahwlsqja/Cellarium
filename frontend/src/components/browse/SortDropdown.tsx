'use client';

import type { SortType } from '@/hooks/useCanvasList';

const SORT_OPTIONS: { label: string; value: SortType }[] = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Most Pixels', value: 'most-pixels' },
  { label: 'Name (A-Z)', value: 'name' },
];

interface SortDropdownProps {
  current: SortType;
  onChange: (sort: SortType) => void;
}

export default function SortDropdown({ current, onChange }: SortDropdownProps) {
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value as SortType)}
      className="font-body text-sm bg-surface text-text-muted border border-grid px-3 py-1.5 hover:border-text-muted focus:border-accent focus:outline-none appearance-none cursor-pointer"
      style={{
        borderRadius: 0,
        transition: 'border-color 0.2s steps(3)',
      }}
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
