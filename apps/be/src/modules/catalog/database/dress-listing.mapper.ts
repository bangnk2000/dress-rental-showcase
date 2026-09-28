import { Injectable } from '@nestjs/common';
import { Money } from '../../../libs/ddd/money.value-object';
import { toDate } from '../../../libs/utils/date';
import { DressListingEntity } from '../domain/dress-listing.entity';
import { ListingSlug } from '../domain/listing-slug.value-object';
import { Occasions } from '../domain/occasion.value-object';
import { DressListingModel } from './dress-listing.persistence.model';

/** Row ⇄ aggregate. The CMS/public DTOs are projected by the query handlers, not here. */
@Injectable()
export class DressListingMapper {
  toDomain(record: DressListingModel, dressIds: string[]): DressListingEntity {
    return new DressListingEntity({
      id: record.id,
      createdAt: toDate(record.created_at),
      updatedAt: toDate(record.updated_at),
      props: {
        slug: ListingSlug.create(record.slug),
        name: record.name,
        tagline: record.tagline,
        description: record.description,
        occasions: Occasions.create(record.occasions),
        retailPrice: record.retail_price === null ? null : Money.create(record.retail_price),
        specs: {
          material: record.material,
          silhouette: record.silhouette,
          length: record.length,
          color: record.color,
          occasionsText: record.occasions_text,
        },
        photoUrls: [...record.photo_urls],
        isHot: record.is_hot,
        publishedAt: record.published_at === null ? null : toDate(record.published_at),
        firstPublishedAt:
          record.first_published_at === null ? null : toDate(record.first_published_at),
        dressIds: [...dressIds],
      },
    });
  }

  toPersistence(entity: DressListingEntity): DressListingModel {
    const props = entity.getProps();
    return {
      id: props.id,
      slug: props.slug.unpack(),
      name: props.name,
      tagline: props.tagline,
      description: props.description,
      occasions: props.occasions.values,
      retail_price: props.retailPrice?.amount ?? null,
      material: props.specs.material,
      silhouette: props.specs.silhouette,
      length: props.specs.length,
      color: props.specs.color,
      occasions_text: props.specs.occasionsText,
      photo_urls: [...props.photoUrls],
      is_hot: props.isHot,
      published_at: props.publishedAt,
      first_published_at: props.firstPublishedAt,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    };
  }
}
