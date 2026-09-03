import { ApiProperty } from '@nestjs/swagger';

/**
 * Business rejections of catalog/create-dress (422) — ADR 0001 §3. `dressCode` is present only
 * for `rejected_dress_code_taken`.
 */
export class CreateDressOutcomeDto {
  @ApiProperty({ enum: ['rejected_dress_code_taken', 'rejected_category_not_found'] })
  readonly status!: 'rejected_dress_code_taken' | 'rejected_category_not_found';

  @ApiProperty({ required: false, description: 'The dress code that is already in use' })
  readonly dressCode?: string;
}
