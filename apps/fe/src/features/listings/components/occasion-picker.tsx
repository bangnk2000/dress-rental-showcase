import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { OCCASIONS, type Occasion } from '../lib/occasions';

interface OccasionPickerProps extends Omit<ComponentProps<'div'>, 'onChange'> {
  value: Occasion[];
  onChange: (value: Occasion[]) => void;
}

/**
 * The occasions as toggle buttons (R4: a fixed set, several per listing, ≥ 1). A tap adds, another
 * tap removes; the order sent follows the fixed set, not the order of taps.
 */
export function OccasionPicker({ value, onChange, className, ...rest }: OccasionPickerProps) {
  const { t } = useTranslation('listings');

  return (
    <div role="group" className={cn('flex flex-wrap gap-2', className)} {...rest}>
      {OCCASIONS.map((occasion) => {
        const selected = value.includes(occasion);
        return (
          <Button
            key={occasion}
            type="button"
            variant={selected ? 'default' : 'outline'}
            aria-pressed={selected}
            className="h-11"
            onClick={() =>
              onChange(
                selected
                  ? value.filter((item) => item !== occasion)
                  : OCCASIONS.filter((item) => item === occasion || value.includes(item)),
              )
            }
          >
            {t(`occasions.${occasion}`)}
          </Button>
        );
      })}
    </div>
  );
}
