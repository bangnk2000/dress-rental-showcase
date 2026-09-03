import { ApiProperty } from '@nestjs/swagger';

/**
 * Business rejections of catalog/duplicate-dress (422) — ADR 0001 §3. `dressCode` is present only
 * for `rejected_dress_code_taken` (the numbering race lost more times than it retries).
 */
export class DuplicateDressOutcomeDto {
  @ApiProperty({ enum: ['rejected_dress_not_found', 'rejected_dress_code_taken'] })
  readonly status!: 'rejected_dress_not_found' | 'rejected_dress_code_taken';

  @ApiProperty({ required: false, description: 'The dress code that is already in use' })
  readonly dressCode?: string;
}
