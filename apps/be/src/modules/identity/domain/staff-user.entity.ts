import { Err, Ok, Result } from 'oxide.ts';
import { AggregateRoot } from '../../../libs/ddd/aggregate-root.base';
import { StaffRole } from '../../../libs/authz/authz.types';
import { UserAlreadyActiveError, UserAlreadyInactiveError } from './identity.errors';
import { UserCreatedDomainEvent } from './events/user-created.domain-event';
import { UserDeactivatedDomainEvent } from './events/user-deactivated.domain-event';
import { UserReactivatedDomainEvent } from './events/user-reactivated.domain-event';

export interface StaffUserProps {
  username: string;
  name: string;
  role: StaffRole;
  passwordHash: string;
  active: boolean;
}

export interface CreateStaffUserProps {
  username: string;
  name: string;
  role: StaffRole;
  passwordHash: string;
}

export class StaffUserEntity extends AggregateRoot<StaffUserProps> {
  static create(create: CreateStaffUserProps, id: string, now: Date): StaffUserEntity {
    const user = new StaffUserEntity({
      id,
      props: { ...create, active: true },
      createdAt: now,
      updatedAt: now,
    });
    user.addEvent(new UserCreatedDomainEvent({ aggregateId: id, username: create.username }));
    return user;
  }

  get username(): string {
    return this.props.username;
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

  get active(): boolean {
    return this.props.active;
  }

  /** Lock, don't delete: history (price changes, QR creators) points at users forever (R3). */
  deactivate(now: Date): Result<void, UserAlreadyInactiveError> {
    if (!this.props.active) return Err(new UserAlreadyInactiveError());
    this.props.active = false;
    this.setUpdatedAt(now);
    this.addEvent(new UserDeactivatedDomainEvent({ aggregateId: this.id }));
    return Ok(undefined);
  }

  reactivate(now: Date): Result<void, UserAlreadyActiveError> {
    if (this.props.active) return Err(new UserAlreadyActiveError());
    this.props.active = true;
    this.setUpdatedAt(now);
    this.addEvent(new UserReactivatedDomainEvent({ aggregateId: this.id }));
    return Ok(undefined);
  }

  /** Owner-set (no email infra). A locked user CAN get a new password — it prepares the unlock. */
  resetPassword(passwordHash: string, now: Date): void {
    this.props.passwordHash = passwordHash;
    this.setUpdatedAt(now);
    this.validate();
  }

  public validate(): void {
    this.guardAgainstEmpty(this.props.username, 'username');
    this.guardAgainstEmpty(this.props.name, 'name');
    this.guardAgainstEmpty(this.props.passwordHash, 'passwordHash');
  }
}
