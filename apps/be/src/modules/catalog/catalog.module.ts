import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DRESS_REPOSITORY } from './application/ports/dress.repository.port';
import { CreateDressHttpController } from './commands/create-dress/create-dress.http.controller';
import { CreateDressService } from './commands/create-dress/create-dress.service';
import { DressMapper } from './database/dress.mapper';
import { DressRepository } from './database/dress.repository';
import { GetDressHttpController } from './queries/get-dress/get-dress.http.controller';
import { GetDressQueryHandler } from './queries/get-dress/get-dress.query-handler';
import { ListDressesHttpController } from './queries/list-dresses/list-dresses.http.controller';
import { ListDressesQueryHandler } from './queries/list-dresses/list-dresses.query-handler';
import './catalog.policies';

@Module({
  imports: [CqrsModule],
  controllers: [CreateDressHttpController, ListDressesHttpController, GetDressHttpController],
  providers: [
    DressMapper,
    CreateDressService,
    ListDressesQueryHandler,
    GetDressQueryHandler,
    { provide: DRESS_REPOSITORY, useClass: DressRepository },
  ],
})
export class CatalogModule {}
