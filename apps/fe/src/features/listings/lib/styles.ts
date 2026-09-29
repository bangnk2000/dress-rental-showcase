import { CreateListingRequestDtoStylesItem } from '@/api/generated/model';

export type Style = CreateListingRequestDtoStylesItem;

/**
 * The fixed style set (spec §1, R4) in display order — the contract enum, so a new code on the
 * BE shows up here as a type change, not a silent gap. Labels live in `listings:styles.<code>`
 * and keep the wording of the web mock (owner decision D).
 */
export const STYLES: readonly Style[] = Object.values(CreateListingRequestDtoStylesItem);
