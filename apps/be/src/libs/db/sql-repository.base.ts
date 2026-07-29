import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import {
  DatabasePool,
  DatabaseTransactionConnection,
  IdentifierSqlToken,
  sql,
  UniqueIntegrityConstraintViolationError,
} from 'slonik';
import { ZodType } from 'zod';
import { AggregateID } from '../ddd/entity.base';
import { AggregateRoot } from '../ddd/aggregate-root.base';
import { Mapper } from '../ddd/mapper.interface';
import { RepositoryPort } from '../ddd/repository.port';
import { ConflictException } from '../exceptions';
import { LoggerPort } from '../ports/logger.port';

type Row = Record<string, unknown>;

export abstract class SqlRepositoryBase<Aggregate extends AggregateRoot<unknown>, Model extends Row>
  implements RepositoryPort<Aggregate>
{
  protected abstract tableName: string;
  protected abstract schema: ZodType<Model>;

  constructor(
    protected readonly pool: DatabasePool,
    protected readonly mapper: Mapper<Aggregate, Model>,
    protected readonly logger: LoggerPort,
    protected readonly eventEmitter: EventEmitter2,
  ) {}

  nextId(): AggregateID {
    return randomUUID();
  }

  async insert(entity: Aggregate): Promise<void> {
    await this.writeInTransaction(entity, (conn, record) => this.insertRow(conn, record));
  }

  async save(entity: Aggregate): Promise<void> {
    await this.writeInTransaction(entity, (conn, record) => this.upsertRow(conn, record));
  }

  async findOneById(id: AggregateID): Promise<Aggregate | null> {
    const row = await this.pool.maybeOne(
      sql.type(this.schema)`SELECT * FROM ${this.table()} WHERE id = ${id}`,
    );
    return row ? this.mapper.toDomain(row) : null;
  }

  protected table(): IdentifierSqlToken {
    return sql.identifier([this.tableName]);
  }

  /** One transaction: the row write AND the aggregate's domain events commit atomically. */
  protected async writeInTransaction(
    entity: Aggregate,
    write: (conn: DatabaseTransactionConnection, record: Model) => Promise<void>,
  ): Promise<void> {
    try {
      await this.pool.transaction(async (conn) => {
        const record = this.mapper.toPersistence(entity);
        await write(conn, record);
        await entity.publishEvents(this.logger, this.eventEmitter);
      });
    } catch (error) {
      if (error instanceof UniqueIntegrityConstraintViolationError) {
        // Constraint backs the service-level precondition; a race surfaces as 409.
        throw new ConflictException('Record violates a uniqueness constraint', error as Error);
      }
      throw error;
    }
  }

  protected async insertRow(conn: DatabaseTransactionConnection, record: Model): Promise<void> {
    const columns = Object.keys(record);
    await conn.query(sql.unsafe`
      INSERT INTO ${this.table()} (${sql.join(
        columns.map((c) => sql.identifier([c])),
        sql.fragment`, `,
      )})
      VALUES (${sql.join(
        columns.map((c) => this.serialize(record[c])),
        sql.fragment`, `,
      )})
    `);
  }

  protected async upsertRow(conn: DatabaseTransactionConnection, record: Model): Promise<void> {
    const columns = Object.keys(record);
    const updatable = columns.filter((c) => c !== 'id' && c !== 'created_at');
    await conn.query(sql.unsafe`
      INSERT INTO ${this.table()} (${sql.join(
        columns.map((c) => sql.identifier([c])),
        sql.fragment`, `,
      )})
      VALUES (${sql.join(
        columns.map((c) => this.serialize(record[c])),
        sql.fragment`, `,
      )})
      ON CONFLICT (id) DO UPDATE SET ${sql.join(
        updatable.map((c) => sql.fragment`${sql.identifier([c])} = EXCLUDED.${sql.identifier([c])}`),
        sql.fragment`, `,
      )}
    `);
  }

  private serialize(value: unknown): string | number | boolean | null {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString();
    return value as string | number | boolean;
  }
}
