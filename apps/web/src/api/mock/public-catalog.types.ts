// Shape of the FUTURE anonymous catalog DTOs (docs/design/web/public-pages.md §4). Only fields that
// are safe to publish: no purchase price, no customers, no calendar. When the BE ships the real
// endpoints these types are replaced by the generated ones and this folder is deleted.

export type PublicStyle = 'short' | 'silk' | 'ao-dai' | 'off-shoulder' | 'sleeved' | 'strappy-strapless';
export type PublicDressBadge = 'available' | 'new' | 'hot';

export interface PublicImage {
  src: string;
  alt: string;
}

export interface PublicDressSummary {
  slug: string;
  name: string;
  tagline: string;
  style: PublicStyle;
  /** Display label of the style as the shop writes it on the card ("Váy ngắn"). */
  styleLabel: string;
  badge: PublicDressBadge;
  rentalPricePerDay: number;
  retailPrice: number;
  cover: PublicImage;
}

export interface PublicDressSize {
  label: string;
  available: boolean;
}

export interface PublicDressSpecs {
  material: string;
  silhouette: string;
  length: string;
  color: string;
  styles: string;
}

export interface PublicDressDetail extends PublicDressSummary {
  description: string;
  images: PublicImage[];
  sizes: PublicDressSize[];
  specs: PublicDressSpecs;
}
