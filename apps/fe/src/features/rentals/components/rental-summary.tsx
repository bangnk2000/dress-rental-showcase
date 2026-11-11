import { ChevronUp } from 'lucide-react';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { formatVnd } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { SelectedDress } from './dress-picker';

/** What the summary says about the deposit; null = the form knows nothing it may show (edit). */
export type SummaryDeposit =
  | { kind: 'collected'; amount: number }
  | { kind: 'reference'; amount: number }
  | null;

interface RentalSummaryProps {
  selected: SelectedDress[];
  subtotal: number;
  /** Parsed discount (FR-RENT-11); 0 = none. */
  discount: number;
  /** subtotal − discount, floored at 0: what the customer pays for the rental. */
  payable: number;
  deposit: SummaryDeposit;
  /** The form-level rejection message, already translated; null = none. */
  alert: string | null;
  submitLabel: string;
  submitting: boolean;
  onCancel: () => void;
}

/**
 * The money of the booking in ONE element (docs/design/rental-form-ux.md P2/P3, E2/E4): at `lg` a
 * panel that sticks in the right column; below `lg` the SAME element is a bar fixed to the bottom
 * of the screen. The bar always shows "Khách trả", the dress count and the submit; the breakdown
 * (dresses, subtotal, discount, deposit) and "Huỷ" are a disclosure above it. One DOM: each node
 * renders once and only its placement changes with the breakpoint (apps/fe/AGENTS.md screen rules).
 *
 * Placement is a grid with explicit rows, because the two layouts order the nodes differently:
 * desktop reads breakdown → Khách trả → deposit → alert → [Huỷ | submit]; the phone puts the
 * breakdown, deposit and Huỷ above a single bar row [toggle | Khách trả | submit]. The grid has no
 * row gap — a collapsed node leaves an empty track, and a gap would still be drawn around it.
 */
export function RentalSummary({
  selected,
  subtotal,
  discount,
  payable,
  deposit,
  alert,
  submitLabel,
  submitting,
  onCancel,
}: RentalSummaryProps) {
  const { t } = useTranslation('rentals');
  const { t: tCommon } = useTranslation('common'); // shared verbs only
  const [expanded, setExpanded] = useState(false);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const breakdownId = `${baseId}-breakdown`;
  const depositId = `${baseId}-deposit`;
  const cancelId = `${baseId}-cancel`;
  const rootRef = useRef<HTMLElement>(null);
  useBottomBarHeight(rootRef);

  // Below lg a collapsed node is hidden; at lg every node shows, whatever the toggle says.
  const collapsible = cn(!expanded && 'max-lg:hidden');

  return (
    <section
      ref={rootRef}
      aria-labelledby={titleId}
      data-bottom-bar=""
      className={cn(
        'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 bg-background',
        // Phone / tablet: the bottom bar, above the page and below the PWA prompt (z-50) and the
        // header (z-40); its bottom padding clears the home indicator.
        'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:border-t max-lg:px-4 max-lg:pt-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:shadow-[0_-4px_12px_rgb(0_0_0/0.08)]',
        // Desktop: the right column, sticky just under the sticky app header (≈ 61px tall).
        'lg:sticky lg:top-20 lg:grid-cols-2 lg:self-start lg:rounded-lg lg:border lg:p-4',
      )}
    >
      <h2
        id={titleId}
        className="text-sm font-semibold max-lg:sr-only lg:col-span-2 lg:row-start-1 lg:pb-3"
      >
        {t('summary.title')}
      </h2>

      {/* Breakdown: the dresses and the subtraction behind "Khách trả" (screen rule: a number the
          user did not type shows its arithmetic). One text node per dress — the picker owns the
          rows staff acts on. */}
      <div
        id={breakdownId}
        className={cn(
          'col-span-3 row-start-1 max-lg:max-h-[45dvh] max-lg:overflow-y-auto max-lg:pb-3 lg:col-span-2 lg:row-start-2 lg:pb-2',
          collapsible,
        )}
      >
        {selected.length > 0 ? (
          <ul className="max-h-60 space-y-1 overflow-y-auto pb-2 text-sm text-muted-foreground tabular-nums">
            {selected.map((dress) => (
              <li key={dress.id} className="break-words">
                {`${dress.code} · ${formatVnd(dress.rentalPrice)}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pb-2 text-sm text-muted-foreground">{t('summary.noDresses')}</p>
        )}
        <dl className="space-y-1 border-t pt-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt>{t('summary.subtotal')}</dt>
            <dd className="tabular-nums">{formatVnd(subtotal)}</dd>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <dt>{t('summary.discount')}</dt>
              <dd className="tabular-nums">−{formatVnd(discount)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {/* Phone only: opens the breakdown above the bar (E2 — a disclosure, not a dialog). */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="col-start-1 row-start-5 lg:hidden"
        aria-expanded={expanded}
        aria-controls={`${breakdownId} ${depositId} ${cancelId}`}
        aria-label={expanded ? t('summary.hideDetails') : t('summary.showDetails')}
        onClick={() => setExpanded((open) => !open)}
      >
        <ChevronUp className={cn('transition-transform', expanded && 'rotate-180')} aria-hidden />
      </Button>

      {/* The result of the subtraction — the one figure staff quotes. Always visible. */}
      <div className="col-start-2 row-start-5 min-w-0 lg:col-span-2 lg:col-start-1 lg:row-start-3 lg:border-t lg:pt-2 lg:pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-sm">
            {t('summary.payable')}{' '}
            <span className="text-muted-foreground">
              ({t('summary.dressCount', { count: selected.length })})
            </span>
          </span>
          <span className="text-lg font-semibold whitespace-nowrap tabular-nums">
            {formatVnd(payable)}
          </span>
        </div>
      </div>

      {/* The deposit is NOT part of the subtraction above. A catalog standard is labelled as a
          reference, never presented as money the shop holds (screen rule). */}
      <div
        id={depositId}
        className={cn(
          'col-span-3 row-start-2 text-sm lg:col-span-2 lg:row-start-4',
          deposit && 'pb-3',
          collapsible,
        )}
      >
        {deposit ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span>
                {deposit.kind === 'collected'
                  ? t('summary.depositCollected')
                  : t('summary.depositReference')}
              </span>
              <span className="tabular-nums">{formatVnd(deposit.amount)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('summary.depositSeparate')}</p>
          </>
        ) : null}
      </div>

      {/* Form-level rejections render HERE, on the always-visible part right above the submit:
          on a phone the staff taps submit in the bar, so the answer must be visible from there. */}
      {alert ? (
        <p
          role="alert"
          className="col-span-3 row-start-4 pb-3 text-sm text-destructive lg:col-span-2 lg:row-start-5"
        >
          {alert}
        </p>
      ) : null}

      <div
        id={cancelId}
        className={cn('col-span-3 row-start-3 max-lg:pb-3 lg:col-span-1 lg:row-start-6', collapsible)}
      >
        <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
          {tCommon('actions.cancel')}
        </Button>
      </div>
      <Button
        type="submit"
        disabled={submitting}
        className="col-start-3 row-start-5 lg:col-start-2 lg:row-start-6"
      >
        {submitLabel}
      </Button>
    </section>
  );
}

/**
 * While the summary is the fixed bottom bar, publish its height as `--bottom-bar-h` on <html>:
 * the form pads its end by it (the last field never hides behind the bar), the PWA update prompt
 * lifts itself above it (it has no dismiss, so covering the submit would force a reload that loses
 * the form). A CSS
 * convention, not an import — the kernel never reads a feature. 0 at lg, where the panel is sticky.
 */
function useBottomBarHeight(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const publish = () => {
      const height =
        getComputedStyle(element).position === 'fixed'
          ? Math.ceil(element.getBoundingClientRect().height)
          : 0;
      root.style.setProperty('--bottom-bar-h', `${height}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    // Crossing lg changes position without necessarily changing the bar's size.
    window.addEventListener('resize', publish);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
      root.style.removeProperty('--bottom-bar-h');
    };
  }, [ref]);
}
