import { ApiProperty } from '@nestjs/swagger';

/** Business rejections of catalog/retire-dress (422) — ADR 0001 §3. */
export class RetireDressOutcomeDto {
  @ApiProperty({ enum: ['rejected_dress_not_found', 'rejected_dress_already_retired'] })
  readonly status!: 'rejected_dress_not_found' | 'rejected_dress_already_retired';
}
