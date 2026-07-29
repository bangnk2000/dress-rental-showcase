import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DRESS_REPOSITORY } from './application/ports/dress.repository.port';
import { CreateDressHttpController } from './commands/create-dress/create-dress.http.controller';
import { CreateDressService } from './commands/create-dress/create-dress.service';
import { DressMapper } from './database/dress.mapper';
import { DressRepository } from './database/dress.repository';
import { ListDressesHttpController } from './queries/list-dresses/list-dresses.http.controller';
import { ListDressesQueryHandler } from './queries/list-dresses/list-dresses.query-handler';
import './catalog.policies';

@Module({
  imports: [CqrsModule],
  controllers: [CreateDressHttpController, ListDressesHttpController],
  providers: [
    DressMapper,
    CreateDressService,
    ListDressesQueryHandler,
    { provide: DRESS_REPOSITORY, useClass: DressRepository },
  ],
})
export class CatalogModule {}
