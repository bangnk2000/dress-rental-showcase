import { Money } from '../../../libs/ddd/money.value-object';
import { ListingSlug } from './listing-slug.value-object';
import { Styles } from './style.value-object';

/** Free-text spec cells shown on the web detail page; each ≤ 120 chars, null = not filled. */
export interface ListingSpecs {
  material: string | null;
  silhouette: string | null;
  length: string | null;
  color: string | null;
  stylesText: string | null;
}

/** The editable CONTENT of a listing — what Create sets and Update may change. */
export interface ListingContent {
  name: string;
  tagline: string;
  description: string;
  styles: Styles;
  /** Market price of a new one, for comparison only. NOT purchasePrice (owner-only cost). */
  retailPrice: Money | null;
  specs: ListingSpecs;
  /** 0..10 photo URLs; the first one is the cover. */
  photoUrls: string[];
  isHot: boolean;
}

export interface DressListingProps extends ListingContent {
  slug: ListingSlug;
  /** Non-null = on the web (if ≥ 1 active dress is attached, R5). */
  publishedAt: Date | null;
  /** Set on the first publish, NEVER cleared — locks the slug (R2) and staff deletion (R8). */
  firstPublishedAt: Date | null;
  /** The attached dresses — a SET (the PK of dress_listing_items). */
  dressIds: string[];
}

export interface CreateListingProps extends ListingContent {
  slug: ListingSlug;
}
