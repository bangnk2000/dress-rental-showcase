import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorFallbackProps {
  onRetry?: () => void;
  className?: string;
}

export function ErrorFallback({ onRetry, className }: ErrorFallbackProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 p-10 text-center',
        className,
      )}
    >
      <p className="text-sm font-medium">{t('states.error')}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('states.retry')}
        </Button>
      ) : null}
    </div>
  );
}
