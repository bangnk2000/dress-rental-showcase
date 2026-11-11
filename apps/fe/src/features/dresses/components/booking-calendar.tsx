import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BookedRangeDto } from '@/api/generated/model';
import { Button } from '@/components/ui/button';

import { dayBookingStatus, type DayBookingStatus } from '../lib/booking-day-status';

const DAY_STATUS_CLASSES: Record<DayBookingStatus, string> = {
  rented: 'bg-destructive text-white dark:bg-destructive/60',
  buffer: 'bg-amber-200 text-amber-950 dark:bg-amber-400/40 dark:text-amber-100',
  free: '',
};

function toIsoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayIso(): string {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Month to open on: the first booking still blocking today or later, else the current month. */
function initialMonth(ranges: readonly BookedRangeDto[]): { year: number; monthIndex: number } {
  const today = todayIso();
  const upcoming = ranges.find((range) => range.blockedUntilDate >= today);
  const anchor = upcoming && upcoming.startDate > today ? upcoming.startDate : today;
  return { year: Number(anchor.slice(0, 4)), monthIndex: Number(anchor.slice(5, 7)) - 1 };
}

/** Month grid (Monday-first, per vi convention) shading rented and buffer days. */
export function BookingCalendar({ ranges }: { ranges: readonly BookedRangeDto[] }) {
  const { t, i18n } = useTranslation('dresses');
  const [month, setMonth] = useState(() => initialMonth(ranges));

  const firstOfMonth = new Date(month.year, month.monthIndex, 1);
  const daysInMonth = new Date(month.year, month.monthIndex + 1, 0).getDate();
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const monthFormat = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' });
  const weekdayFormat = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });
  // 2024-01-01 is a Monday — formats the seven weekday headers in order.
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFormat.format(new Date(2024, 0, 1 + i)));

  function shiftMonth(delta: number): void {
    setMonth(({ year, monthIndex }) => {
      const shifted = new Date(year, monthIndex + delta, 1);
      return { year: shifted.getFullYear(), monthIndex: shifted.getMonth() };
    });
  }

  return (
    <div className="max-w-md rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t('detail.calendar.prevMonth')}
          onClick={() => shiftMonth(-1)}
        >
          ‹
        </Button>
        <p className="text-sm font-medium capitalize">{monthFormat.format(firstOfMonth)}</p>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t('detail.calendar.nextMonth')}
          onClick={() => shiftMonth(1)}
        >
          ›
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-sm">
        {weekdays.map((label) => (
          <span key={label} className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = toIsoDate(month.year, month.monthIndex, i + 1);
          const status = dayBookingStatus(date, ranges);
          return (
            <span
              key={date}
              data-date={date}
              data-status={status}
              className={`rounded-md py-1 tabular-nums ${DAY_STATUS_CLASSES[status]}`}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-destructive dark:bg-destructive/60" />
          {t('detail.calendar.legend.rented')}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-amber-200 dark:bg-amber-400/40" />
          {t('detail.calendar.legend.buffer')}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm border" />
          {t('detail.calendar.legend.free')}
        </li>
      </ul>
    </div>
  );
}
