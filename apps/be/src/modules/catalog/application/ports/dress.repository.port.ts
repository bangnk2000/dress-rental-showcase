import { RepositoryPort } from '../../../../libs/ddd/repository.port';
import { DressEntity } from '../../domain/dress.entity';

export const DRESS_REPOSITORY = Symbol('DRESS_REPOSITORY');

export interface DressRepositoryPort extends RepositoryPort<DressEntity> {
  findOneByCode(code: string): Promise<DressEntity | null>;
}
