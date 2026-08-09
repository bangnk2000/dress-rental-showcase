import { ApiProperty } from '@nestjs/swagger';

/**
 * Business rejections of catalog/update-dress (422) — ADR 0001 §3. `dressCode` is present only
 * for `rejected_dress_code_taken`.
 */
export class UpdateDressOutcomeDto {
  @ApiProperty({ enum: ['rejected_dress_not_found', 'rejected_dress_code_taken'] })
  readonly status!: 'rejected_dress_not_found' | 'rejected_dress_code_taken';

  @ApiProperty({ required: false, description: 'The dress code that is already in use' })
  readonly dressCode?: string;
}
