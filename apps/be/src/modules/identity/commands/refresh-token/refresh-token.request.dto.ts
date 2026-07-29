import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  readonly refreshToken!: string;
}
