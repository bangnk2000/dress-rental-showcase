import { ApiProperty } from '@nestjs/swagger';

export class IdResponse {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }
}
