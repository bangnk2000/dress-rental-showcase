import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <div
      role="status"
      className={cn('flex items-center justify-center p-8', className)}
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
