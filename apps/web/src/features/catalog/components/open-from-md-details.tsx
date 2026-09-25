import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Accordion on mobile (closed), always open from md up (design/responsive.md §4 Product).
 * Two server-rendered structures switched by CSS, so the md+ content is in the static HTML and
 * visible without JavaScript — never toggled by a client-side media query.
 */
export function OpenFromMdDetails({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <div>
      <details className="group/d md:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-label-lg text-on-surface">
          {summary}
          <ChevronDown className="h-4 w-4 transition-transform group-open/d:rotate-180" aria-hidden />
        </summary>
        {children}
      </details>
      <div className="hidden md:block">
        <h3 className="flex min-h-12 items-center text-label-lg text-on-surface">{summary}</h3>
        {children}
      </div>
    </div>
  );
}
