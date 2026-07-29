import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  readonly email!: string;

  @ApiProperty({ example: 'changeme' })
  @IsString()
  @MinLength(1)
  readonly password!: string;
}
