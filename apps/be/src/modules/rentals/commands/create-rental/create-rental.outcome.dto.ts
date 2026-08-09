import { ApiProperty } from '@nestjs/swagger';

/**
 * Business rejections of rentals/create-rental (422) — outcome catalog in
 * docs/adr/0001-outcome-model-at-the-http-boundary.md §3. `dressIds` names ONLY the offending
 * dresses, so the form can point at the right rows without a follow-up request.
 */
export class CreateRentalOutcomeDto {
  @ApiProperty({
    enum: ['rejected_dress_not_found', 'rejected_dress_retired', 'rejected_dress_unavailable'],
  })
  readonly status!:
    | 'rejected_dress_not_found'
    | 'rejected_dress_retired'
    | 'rejected_dress_unavailable';

  @ApiProperty({ type: [String], format: 'uuid' })
  readonly dressIds!: string[];
}
