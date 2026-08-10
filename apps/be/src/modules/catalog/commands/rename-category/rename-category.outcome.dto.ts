import { ApiProperty } from '@nestjs/swagger';

/** Business rejections of catalog/rename-category (422) — ADR 0001 §3. */
export class RenameCategoryOutcomeDto {
  @ApiProperty({ enum: ['rejected_category_not_found', 'rejected_category_name_taken'] })
  readonly status!: 'rejected_category_not_found' | 'rejected_category_name_taken';

  @ApiProperty({ example: 'Dạ hội', required: false })
  readonly name?: string;
}
