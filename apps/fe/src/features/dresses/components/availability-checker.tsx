import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useCheckAvailabilityHttpControllerCheck } from '@/api/generated/rentals/rentals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/format';

interface CheckedRange {
  startDate: string;
  endDate: string;
}

/**
 * "Is this dress free from A to B?" — asks the server, which mirrors the
 * create-rental precondition (cleaning buffer included). The result always
 * belongs to the submitted range: editing an input clears it.
 */
export function AvailabilityChecker({ dressId }: { dressId: string }) {
  const { t } = useTranslation('dresses');
  const startId = useId();
  const endId = useId();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [checked, setChecked] = useState<CheckedRange | null>(null);
  const [invalid, setInvalid] = useState(false);

  const query = useCheckAvailabilityHttpControllerCheck(
    dressId,
    checked ?? { startDate: '', endDate: '' },
    { query: { enabled: checked !== null } },
  );

  function onDateChange(setter: (value: string) => void) {
    return (event: FormEvent<HTMLInputElement>) => {
      setter(event.currentTarget.value);
      setChecked(null);
      setInvalid(false);
    };
  }

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!startDate || !endDate || startDate > endDate) {
      setInvalid(true);
      setChecked(null);
      return;
    }
    setInvalid(false);
    setChecked({ startDate, endDate });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={startId}>{t('detail.checker.startLabel')}</Label>
          <Input
            id={startId}
            type="date"
            value={startDate}
            onChange={onDateChange(setStartDate)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={endId}>{t('detail.checker.endLabel')}</Label>
          <Input id={endId} type="date" value={endDate} onChange={onDateChange(setEndDate)} />
        </div>
        <Button type="submit" disabled={query.isFetching}>
          {t('detail.checker.submit')}
        </Button>
      </form>
      {invalid ? (
        <p role="alert" className="text-sm text-destructive">
          {t('detail.checker.invalidRange')}
        </p>
      ) : null}
      {checked && query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t('detail.checker.error')}
        </p>
      ) : null}
      {checked && query.data ? (
        query.data.available ? (
          <p role="status" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {t('detail.checker.available', {
              start: formatDate(checked.startDate),
              end: formatDate(checked.endDate),
            })}
          </p>
        ) : (
          <div role="status" className="space-y-1">
            <p className="text-sm font-medium text-destructive">
              {t('detail.checker.unavailable')}
            </p>
            <ul className="text-sm text-muted-foreground">
              {query.data.conflicts.map((conflict) => (
                <li key={`${conflict.rentalId}-${conflict.startDate}`}>
                  {t('detail.checker.conflict', {
                    start: formatDate(conflict.startDate),
                    end: formatDate(conflict.endDate),
                    blockedUntil: formatDate(conflict.blockedUntilDate),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </div>
  );
}
