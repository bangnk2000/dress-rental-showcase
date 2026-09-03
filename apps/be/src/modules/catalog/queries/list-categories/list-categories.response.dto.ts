import { ApiProperty } from '@nestjs/swagger';

export class CategoryDto {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id!: string;

  @ApiProperty({ example: 'Dạ hội' })
  readonly name!: string;

  @ApiProperty({ example: 12, description: 'How many dresses hold this category' })
  readonly dressCount!: number;
}

export class CategoryListResponseDto {
  @ApiProperty({ type: [CategoryDto] })
  readonly data!: CategoryDto[];
}
