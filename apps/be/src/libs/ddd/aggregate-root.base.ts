import { EventEmitter2 } from '@nestjs/event-emitter';
import { Entity } from './entity.base';
import { DomainEvent } from './domain-event.base';
import { LoggerPort } from '../ports/logger.port';

export abstract class AggregateRoot<EntityProps> extends Entity<EntityProps> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return this._domainEvents;
  }

  protected addEvent(domainEvent: DomainEvent): void {
    this._domainEvents.push(domainEvent);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Called by the repository AFTER the write succeeds, INSIDE the transaction,
   * so side effects only run when the aggregate is durably saved.
   */
  public async publishEvents(logger: LoggerPort, eventEmitter: EventEmitter2): Promise<void> {
    await Promise.all(
      this.domainEvents.map((event) => {
        logger.debug(`"${event.constructor.name}" event published for ${this.id}`);
        return eventEmitter.emitAsync(event.constructor.name, event);
      }),
    );
    this.clearEvents();
  }
}
