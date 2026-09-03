import { RepositoryPort } from '../../../../libs/ddd/repository.port';
import { StaffUserEntity } from '../../domain/staff-user.entity';

export const STAFF_USER_REPOSITORY = Symbol('STAFF_USER_REPOSITORY');

export interface StaffUserRepositoryPort extends RepositoryPort<StaffUserEntity> {
  findOneByUsername(username: string): Promise<StaffUserEntity | null>;
  findAll(): Promise<StaffUserEntity[]>;
}
