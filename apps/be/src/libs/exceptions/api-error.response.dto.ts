import { ApiProperty } from '@nestjs/swagger';

/** One field-level detail of a validation fault. */
export class ApiErrorDetailDto {
  @ApiProperty({ required: false, description: 'Request field the detail points at' })
  readonly field?: string;

  @ApiProperty({ required: false, description: "Violated rule, e.g. 'min', 'format'" })
  readonly rule?: string;

  @ApiProperty()
  readonly message!: string;

  @ApiProperty({
    required: false,
    type: 'integer',
    description: 'Byte limit of a size rule — set by PHOTO.TOO_LARGE',
  })
  readonly maxBytes?: number;
}

export class ApiErrorBodyDto {
  @ApiProperty({
    example: 'GENERIC.VALIDATION',
    description: 'Stable machine code — branch on this, never parse `message`',
  })
  readonly code!: string;

  @ApiProperty()
  readonly message!: string;

  @ApiProperty({ type: [ApiErrorDetailDto], required: false })
  readonly details?: ApiErrorDetailDto[];

  @ApiProperty({ required: false, description: 'Echo of the x-request-id header' })
  readonly correlationId?: string;
}

/**
 * THE shared fault envelope — one DTO for the whole API so Orval emits it once
 * (docs/spec/init-monorepo-contract/02-contract-pipeline.md §3). Technical/transport faults only:
 * business rejections are outcome bodies, declared per operation
 * (docs/adr/0001-outcome-model-at-the-http-boundary.md §2).
 */
export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorBodyDto })
  readonly error!: ApiErrorBodyDto;
}
