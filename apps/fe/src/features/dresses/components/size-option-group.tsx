import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { SIZE_OPTIONS } from '../schemas/dress-form.schema';

interface SizeOptionGroupProps extends Omit<ComponentProps<'div'>, 'onChange'> {
  /** The chosen size label, '' = none. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * The size as five thumb-sized buttons instead of a text field (FR-CAT-08): one tap selects, a
 * second tap on the selected one clears. A value outside the standard five — a CSV-imported "38",
 * an older free-text entry — is shown as a sixth, selected button, so opening the edit dialog
 * never silently drops a size the shop had recorded.
 */
export function SizeOptionGroup({ value, onChange, className, ...rest }: SizeOptionGroupProps) {
  const options = value && !SIZE_OPTIONS.includes(value) ? [...SIZE_OPTIONS, value] : SIZE_OPTIONS;

  return (
    <div role="group" className={cn('flex flex-wrap gap-2', className)} {...rest}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Button
            key={option}
            type="button"
            variant={selected ? 'default' : 'outline'}
            aria-pressed={selected}
            className="h-11 min-w-12"
            onClick={() => onChange(selected ? '' : option)}
          >
            {option}
          </Button>
        );
      })}
    </div>
  );
}
