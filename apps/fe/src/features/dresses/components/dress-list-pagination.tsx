import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

interface DressListPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function DressListPagination({ page, totalPages, onPageChange }: DressListPaginationProps) {
  const { t } = useTranslation('dresses');

  return (
    <nav className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('list.pagination.previous')}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t('list.pagination.label', { page, totalPages })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('list.pagination.next')}
      </Button>
    </nav>
  );
}
