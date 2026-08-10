import { ApiProperty } from '@nestjs/swagger';

/** Business rejection of catalog/create-dress (422) — ADR 0001 §3. */
export class CreateDressOutcomeDto {
  @ApiProperty({ enum: ['rejected_dress_code_taken'] })
  readonly status!: 'rejected_dress_code_taken';

  @ApiProperty({ description: 'The dress code that is already in use' })
  readonly dressCode!: string;
}
