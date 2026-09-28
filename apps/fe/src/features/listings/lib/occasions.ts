import { CreateListingRequestDtoOccasionsItem } from '@/api/generated/model';

export type Occasion = CreateListingRequestDtoOccasionsItem;

/**
 * The fixed occasion set (spec §1, R4) in display order — the contract enum, so a new code on the
 * BE shows up here as a type change, not a silent gap. Labels live in `listings:occasions.<code>`
 * and keep the wording of the web mock (owner decision D).
 */
export const OCCASIONS: readonly Occasion[] = Object.values(CreateListingRequestDtoOccasionsItem);
