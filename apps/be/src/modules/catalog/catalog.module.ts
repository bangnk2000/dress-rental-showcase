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
import './catalog.policies';

@Module({
  imports: [CqrsModule],
  controllers: [
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
    { provide: DRESS_REPOSITORY, useClass: DressRepository },
    { provide: CATEGORY_REPOSITORY, useClass: CategoryRepository },
  ],
})
export class CatalogModule {}
