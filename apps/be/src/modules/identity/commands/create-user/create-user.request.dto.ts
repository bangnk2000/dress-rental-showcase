import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserRequestDto {
  @ApiProperty({
    example: 'lan',
    description: '3-30 chars: lowercase letters, digits, dot, underscore, dash (case-insensitive)',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/, {
    message: 'username must be 3-30 chars of letters, digits, dot, underscore or dash',
  })
  readonly username!: string;

  @ApiProperty({ example: 'Chị Lan', description: 'Display name shown in audit trails' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  readonly name!: string;

  @ApiProperty({ example: 'matkhau-cua-lan', minLength: 8 })
  @IsString()
  @MinLength(8)
  readonly password!: string;
}
