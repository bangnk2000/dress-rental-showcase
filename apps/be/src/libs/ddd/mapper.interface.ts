export interface Mapper<DomainEntity, DbModel, ResponseDto = unknown> {
  toDomain(record: DbModel): DomainEntity;
  toPersistence(entity: DomainEntity): DbModel;
  toResponse(entity: DomainEntity): ResponseDto;
}
