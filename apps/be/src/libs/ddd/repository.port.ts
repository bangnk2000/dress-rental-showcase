import { AggregateID } from './entity.base';

export interface RepositoryPort<Aggregate> {
  insert(entity: Aggregate): Promise<void>;
  save(entity: Aggregate): Promise<void>;
  findOneById(id: AggregateID): Promise<Aggregate | null>;
  /** Id generation belongs to infrastructure, never the domain. */
  nextId(): AggregateID;
}
