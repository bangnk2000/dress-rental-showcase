import { ApiProperty } from '@nestjs/swagger';

/** Business rejections of catalog/delete-category (422) — ADR 0001 §3. */
export class DeleteCategoryOutcomeDto {
  @ApiProperty({ enum: ['rejected_category_not_found', 'rejected_category_in_use'] })
  readonly status!: 'rejected_category_not_found' | 'rejected_category_in_use';

  @ApiProperty({
    example: 12,
    required: false,
    description: 'How many dresses still hold the category (rejected_category_in_use)',
  })
  readonly dressCount?: number;
}
