import { AggregateRoot } from '../../../libs/ddd/aggregate-root.base';
import { CategoryName } from './category-name.value-object';
import { CategoryCreatedDomainEvent } from './events/category-created.domain-event';
import { CategoryRenamedDomainEvent } from './events/category-renamed.domain-event';

export interface CategoryProps {
  name: CategoryName;
}

/**
 * Second aggregate root of catalog (dress-category spec R2): a lightweight label with its own
 * lifecycle. It never touches dresses — the relation is the nullable FK on THEIR side, and
 * deleting a category is refused while any dress still points at it (R3/R4).
 */
export class CategoryEntity extends AggregateRoot<CategoryProps> {
  static create(name: CategoryName, id: string, now: Date): CategoryEntity {
    const category = new CategoryEntity({ id, props: { name }, createdAt: now, updatedAt: now });
    category.addEvent(new CategoryCreatedDomainEvent({ aggregateId: id, name: name.unpack() }));
    return category;
  }

  get name(): CategoryName {
    return this.props.name;
  }

  rename(name: CategoryName, now: Date): void {
    this.props.name = name;
    this.setUpdatedAt(now);
    this.addEvent(new CategoryRenamedDomainEvent({ aggregateId: this.id, name: name.unpack() }));
    this.validate();
  }

  public validate(): void {
    this.guardAgainstEmpty(this.props.name, 'name');
  }
}
