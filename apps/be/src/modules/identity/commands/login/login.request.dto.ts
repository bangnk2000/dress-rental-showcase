import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'owner', description: 'Login username (case-insensitive)' })
  @IsString()
  @MinLength(1)
  readonly username!: string;

  @ApiProperty({ example: 'changeme' })
  @IsString()
  @MinLength(1)
  readonly password!: string;
}
