import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateUrlCodeRequestDto {
  @ApiProperty({ example: 'https://example.com/lookbook' })
  @IsString()
  @Length(1, 2048)
  readonly targetUrl!: string;

  @ApiPropertyOptional({ maxLength: 120, example: 'Lookbook August' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  readonly label?: string;
}
