import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateCategoryRequestDto {
  @ApiProperty({ example: 'Dạ hội', description: '1-50 chars; unique case-insensitively' })
  @IsString()
  @Length(1, 50)
  readonly name!: string;
}
