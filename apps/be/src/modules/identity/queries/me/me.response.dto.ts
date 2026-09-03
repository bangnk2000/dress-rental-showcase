import { ApiProperty } from '@nestjs/swagger';

export class MeResponseDto {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id!: string;

  @ApiProperty({ example: 'owner' })
  readonly username!: string;

  @ApiProperty({ example: 'Chị Hoa' })
  readonly name!: string;

  @ApiProperty({ enum: ['owner', 'staff'], example: 'owner' })
  readonly role!: 'owner' | 'staff';
}
