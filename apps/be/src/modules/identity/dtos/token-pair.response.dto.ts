import { ApiProperty } from '@nestjs/swagger';

export class TokenPairResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token (Bearer)' })
  readonly accessToken!: string;

  @ApiProperty({ description: 'Long-lived refresh token' })
  readonly refreshToken!: string;
}
