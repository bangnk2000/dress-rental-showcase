import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { STYLES, type Style } from '../lib/styles';

interface StylePickerProps extends Omit<ComponentProps<'div'>, 'onChange'> {
  value: Style[];
  onChange: (value: Style[]) => void;
}

/**
 * The styles as toggle buttons (R4: a fixed set, several per listing, ≥ 1). A tap adds, another
 * tap removes; the order sent follows the fixed set, not the order of taps.
 */
export function StylePicker({ value, onChange, className, ...rest }: StylePickerProps) {
  const { t } = useTranslation('listings');

  return (
    <div role="group" className={cn('flex flex-wrap gap-2', className)} {...rest}>
      {STYLES.map((style) => {
        const selected = value.includes(style);
        return (
          <Button
            key={style}
            type="button"
            variant={selected ? 'default' : 'outline'}
            aria-pressed={selected}
            className="h-11"
            onClick={() =>
              onChange(
                selected
                  ? value.filter((item) => item !== style)
                  : STYLES.filter((item) => item === style || value.includes(item)),
              )
            }
          >
            {t(`styles.${style}`)}
          </Button>
        );
      })}
    </div>
  );
}
