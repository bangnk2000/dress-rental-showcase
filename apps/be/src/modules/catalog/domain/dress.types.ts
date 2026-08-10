import { Money } from '../../../libs/ddd/money.value-object';
import { DressCode } from './dress-code.value-object';

/** Lifecycle status owned by catalog. Operational status (renting/cleaning) is derived from rentals on the read side. */
export type DressStatus = 'active' | 'retired';

export interface DressProps {
  code: DressCode;
  name: string;
  sizeLabel: string | null;
  rentalPrice: Money;
  depositAmount: Money;
  status: DressStatus;
  notes: string | null;
  /** Photo LINKS (staff paste them); binary upload is a deliberate MVP non-goal. */
  photoUrls: string[];
  /** 0..1 category (FR-CAT-07); null = unclassified, a valid state forever. */
  categoryId: string | null;
}

export interface CreateDressProps {
  code: DressCode;
  name: string;
  sizeLabel: string | null;
  rentalPrice: Money;
  depositAmount: Money;
  notes: string | null;
  photoUrls: string[];
  categoryId: string | null;
}
