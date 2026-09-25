'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

const MD = '(min-width: 768px)';

/** Accordion on mobile (closed), always open from md up (design/responsive.md §4 Product). */
export function OpenFromMdDetails({ summary, children }: { summary: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const mq = window.matchMedia?.(MD);
    if (!mq) return;
    const sync = () => {
      if (ref.current) ref.current.open = mq.matches;
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <details ref={ref} className="group/d">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-label-lg text-on-surface">
        {summary}
        <ChevronDown className="h-4 w-4 transition-transform group-open/d:rotate-180" aria-hidden />
      </summary>
      {children}
    </details>
  );
}
