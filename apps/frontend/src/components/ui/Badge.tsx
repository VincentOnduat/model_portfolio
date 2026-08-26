import type { ReactNode } from 'react';

export type BadgeTone = 'green' | 'amber' | 'red' | 'slate' | 'brand';

const TONE_CLASS: Record<BadgeTone, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-100 text-brand-700',
};

/**
 * Shared status pill. Consolidates status-color logic that used to be
 * reimplemented independently (with different color choices) in several
 * pages - callers pick the semantic `tone`, not a raw color.
 */
export function Badge({ tone, children, className = '' }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}
