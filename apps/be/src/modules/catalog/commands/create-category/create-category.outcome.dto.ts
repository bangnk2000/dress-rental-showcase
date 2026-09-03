import { ApiProperty } from '@nestjs/swagger';

/** Business rejection of catalog/create-category (422) — ADR 0001 §3. */
export class CreateCategoryOutcomeDto {
  @ApiProperty({ enum: ['rejected_category_name_taken'] })
  readonly status!: 'rejected_category_name_taken';

  @ApiProperty({ example: 'Dạ hội', description: 'The trimmed name that collided' })
  readonly name!: string;
}
