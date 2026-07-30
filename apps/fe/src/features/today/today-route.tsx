import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetTodayBoardHttpControllerGetSuspense } from '@/api/generated/rentals/rentals';
import { PageHeader } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';

import { TodayBoardSection } from './components/today-board-section';
import { localDateIso } from './lib/local-date';

/** The morning screen: what goes out on the date, what comes back. */
export function TodayRoute() {
  const { t } = useTranslation('today');
  const [date, setDate] = useState(() => localDateIso());
  const { data: board } = useGetTodayBoardHttpControllerGetSuspense({ date });

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Input
            type="date"
            aria-label={t('dateLabel')}
            value={date}
            onChange={(event) => {
              // clearing a native date input yields '' — keep the last real date
              if (event.target.value) setDate(event.target.value);
            }}
            className="w-auto"
          />
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <TodayBoardSection
          title={t('dueOut.title')}
          emptyText={t('dueOut.empty')}
          rentals={board.dueOut}
        />
        <TodayBoardSection
          title={t('dueBack.title')}
          emptyText={t('dueBack.empty')}
          rentals={board.dueBack}
        />
      </div>
    </>
  );
}
