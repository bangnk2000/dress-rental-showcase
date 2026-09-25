// Shape of the FUTURE anonymous catalog DTOs (docs/design/web/public-pages.md §4). Only fields that
// are safe to publish: no purchase price, no customers, no calendar. When the BE ships the real
// endpoints these types are replaced by the generated ones and this folder is deleted.

export type PublicOccasion = 'gala' | 'birthday' | 'ao-dai' | 'tea-party' | 'wedding-guest' | 'yearbook';
export type PublicDressBadge = 'available' | 'new' | 'hot';

export interface PublicImage {
  src: string;
  alt: string;
}

export interface PublicDressSummary {
  slug: string;
  name: string;
  tagline: string;
  occasion: PublicOccasion;
  /** Display label of the occasion as the shop writes it on the card ("Gala & Red Carpet"). */
  occasionLabel: string;
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
  occasions: string;
}

export interface PublicDressDetail extends PublicDressSummary {
  description: string;
  images: PublicImage[];
  sizes: PublicDressSize[];
  specs: PublicDressSpecs;
}
