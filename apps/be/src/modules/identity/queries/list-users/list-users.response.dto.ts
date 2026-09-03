import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id!: string;

  @ApiProperty({ example: 'lan' })
  readonly username!: string;

  @ApiProperty({ example: 'Chị Lan' })
  readonly name!: string;

  @ApiProperty({ enum: ['owner', 'staff'], example: 'staff' })
  readonly role!: 'owner' | 'staff';

  @ApiProperty({ example: true, description: 'false = locked (cannot log in or refresh)' })
  readonly active!: boolean;

  @ApiProperty({ example: '2026-08-10T03:00:00.000Z' })
  readonly createdAt!: string;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserDto] })
  readonly data!: UserDto[];
}
