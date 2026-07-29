import { AggregateRoot } from '../../../libs/ddd/aggregate-root.base';
import { StaffRole } from '../../../libs/authz/authz.types';

export interface StaffUserProps {
  email: string;
  name: string;
  role: StaffRole;
  passwordHash: string;
}

export interface CreateStaffUserProps {
  email: string;
  name: string;
  role: StaffRole;
  passwordHash: string;
}

export class StaffUserEntity extends AggregateRoot<StaffUserProps> {
  static create(create: CreateStaffUserProps, id: string, now: Date): StaffUserEntity {
    return new StaffUserEntity({ id, props: { ...create }, createdAt: now, updatedAt: now });
  }

  get email(): string {
    return this.props.email;
  }

  get name(): string {
    return this.props.name;
  }

  get role(): StaffRole {
    return this.props.role;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  public validate(): void {
    this.guardAgainstEmpty(this.props.email, 'email');
    this.guardAgainstEmpty(this.props.name, 'name');
    this.guardAgainstEmpty(this.props.passwordHash, 'passwordHash');
  }
}
