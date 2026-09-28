import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CATEGORY_REPOSITORY } from './application/ports/category.repository.port';
import { DRESS_REPOSITORY } from './application/ports/dress.repository.port';
import { CreateCategoryHttpController } from './commands/create-category/create-category.http.controller';
import { CreateCategoryService } from './commands/create-category/create-category.service';
import { CreateDressHttpController } from './commands/create-dress/create-dress.http.controller';
import { CreateDressService } from './commands/create-dress/create-dress.service';
import { CreatePhotoUploadUrlHttpController } from './commands/create-photo-upload-url/create-photo-upload-url.http.controller';
import { CreatePhotoUploadUrlService } from './commands/create-photo-upload-url/create-photo-upload-url.service';
import { DeleteCategoryHttpController } from './commands/delete-category/delete-category.http.controller';
import { DeleteCategoryService } from './commands/delete-category/delete-category.service';
import { DuplicateDressHttpController } from './commands/duplicate-dress/duplicate-dress.http.controller';
import { DuplicateDressService } from './commands/duplicate-dress/duplicate-dress.service';
import { RenameCategoryHttpController } from './commands/rename-category/rename-category.http.controller';
import { RenameCategoryService } from './commands/rename-category/rename-category.service';
import { RetireDressHttpController } from './commands/retire-dress/retire-dress.http.controller';
import { RetireDressService } from './commands/retire-dress/retire-dress.service';
import { UpdateDressHttpController } from './commands/update-dress/update-dress.http.controller';
import { UpdateDressService } from './commands/update-dress/update-dress.service';
import { CategoryMapper } from './database/category.mapper';
import { CategoryRepository } from './database/category.repository';
import { DressMapper } from './database/dress.mapper';
import { DressRepository } from './database/dress.repository';
import { photoUploadSignerProvider } from './database/photo-upload-signer.provider';
import { GetDressHttpController } from './queries/get-dress/get-dress.http.controller';
import { GetDressQueryHandler } from './queries/get-dress/get-dress.query-handler';
import { ListCategoriesHttpController } from './queries/list-categories/list-categories.http.controller';
import { ListCategoriesQueryHandler } from './queries/list-categories/list-categories.query-handler';
import { ListDressesHttpController } from './queries/list-dresses/list-dresses.http.controller';
import { ListDressesQueryHandler } from './queries/list-dresses/list-dresses.query-handler';
import { ListPriceHistoryHttpController } from './queries/list-price-history/list-price-history.http.controller';
import { ListPriceHistoryQueryHandler } from './queries/list-price-history/list-price-history.query-handler';
import { PublicThrottleModule } from '../../libs/throttle/public-throttle.module';
import { DRESS_LISTING_REPOSITORY } from './application/ports/dress-listing.repository.port';
import { CreateListingHttpController } from './commands/create-listing/create-listing.http.controller';
import { CreateListingService } from './commands/create-listing/create-listing.service';
import { DeleteListingHttpController } from './commands/delete-listing/delete-listing.http.controller';
import { DeleteListingService } from './commands/delete-listing/delete-listing.service';
import { PublishListingHttpController } from './commands/publish-listing/publish-listing.http.controller';
import { PublishListingService } from './commands/publish-listing/publish-listing.service';
import { SetListingDressesHttpController } from './commands/set-listing-dresses/set-listing-dresses.http.controller';
import { SetListingDressesService } from './commands/set-listing-dresses/set-listing-dresses.service';
import { UnpublishListingHttpController } from './commands/unpublish-listing/unpublish-listing.http.controller';
import { UnpublishListingService } from './commands/unpublish-listing/unpublish-listing.service';
import { UpdateListingHttpController } from './commands/update-listing/update-listing.http.controller';
import { UpdateListingService } from './commands/update-listing/update-listing.service';
import { DressListingMapper } from './database/dress-listing.mapper';
import { DressListingRepository } from './database/dress-listing.repository';
import { GetListingHttpController } from './queries/get-listing/get-listing.http.controller';
import { GetListingQueryHandler } from './queries/get-listing/get-listing.query-handler';
import { GetPublicDressHttpController } from './queries/get-public-dress/get-public-dress.http.controller';
import { GetPublicDressQueryHandler } from './queries/get-public-dress/get-public-dress.query-handler';
import { ListListingsHttpController } from './queries/list-listings/list-listings.http.controller';
import { ListListingsQueryHandler } from './queries/list-listings/list-listings.query-handler';
import { ListPublicDressesHttpController } from './queries/list-public-dresses/list-public-dresses.http.controller';
import { ListPublicDressesQueryHandler } from './queries/list-public-dresses/list-public-dresses.query-handler';
import './catalog.policies';

@Module({
  // The throttler is imported HERE only: the public controllers opt in with @UseGuards.
  imports: [CqrsModule, PublicThrottleModule],
  // Route order is contract (apps/be/AGENTS.md): literal siblings before `:id` / `:slug`.
  controllers: [
    // FR-CAT-09 public listings (CMS)
    CreateListingHttpController,
    ListListingsHttpController,
    UpdateListingHttpController,
    SetListingDressesHttpController,
    PublishListingHttpController,
    UnpublishListingHttpController,
    DeleteListingHttpController,
    GetListingHttpController,
    // FR-WEB-05 anonymous catalogue
    ListPublicDressesHttpController,
    GetPublicDressHttpController,
    CreateDressHttpController,
    UpdateDressHttpController,
    RetireDressHttpController,
    DuplicateDressHttpController,
    ListDressesHttpController,
    GetDressHttpController,
    CreateCategoryHttpController,
    RenameCategoryHttpController,
    DeleteCategoryHttpController,
    ListCategoriesHttpController,
    ListPriceHistoryHttpController,
    CreatePhotoUploadUrlHttpController,
  ],
  providers: [
    DressMapper,
    CategoryMapper,
    CreateDressService,
    UpdateDressService,
    RetireDressService,
    DuplicateDressService,
    CreateCategoryService,
    RenameCategoryService,
    DeleteCategoryService,
    ListDressesQueryHandler,
    GetDressQueryHandler,
    ListCategoriesQueryHandler,
    ListPriceHistoryQueryHandler,
    CreatePhotoUploadUrlService,
    photoUploadSignerProvider,
    DressListingMapper,
    CreateListingService,
    UpdateListingService,
    SetListingDressesService,
    PublishListingService,
    UnpublishListingService,
    DeleteListingService,
    ListListingsQueryHandler,
    GetListingQueryHandler,
    ListPublicDressesQueryHandler,
    GetPublicDressQueryHandler,
    { provide: DRESS_LISTING_REPOSITORY, useClass: DressListingRepository },
    { provide: DRESS_REPOSITORY, useClass: DressRepository },
    { provide: CATEGORY_REPOSITORY, useClass: CategoryRepository },
  ],
})
export class CatalogModule {}
