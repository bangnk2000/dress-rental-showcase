import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import { ConflictException } from '../../../../libs/exceptions';
import { DressCodeAlreadyExistsError } from '../../domain/dress.errors';
import { CreateDressCommand } from './create-dress.command';
import { CreateDressRequestDto } from './create-dress.request.dto';
import { CreateDressResult } from './create-dress.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class CreateDressHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @RequirePermission('dress:create')
  @ApiOperation({ summary: 'Add a dress to the catalog' })
  @ApiCreatedResponse({ type: IdResponse })
  @ApiResponse({ status: 409, description: 'Dress code already exists' })
  async create(@Body() body: CreateDressRequestDto): Promise<IdResponse> {
    const result: CreateDressResult = await this.commandBus.execute(
      new CreateDressCommand({
        code: body.code,
        name: body.name,
        sizeLabel: body.sizeLabel ?? null,
        rentalPrice: body.rentalPrice,
        depositAmount: body.depositAmount,
        notes: body.notes ?? null,
      }),
    );

    return match(result, {
      Ok: (id) => new IdResponse(id),
      Err: (error: Error) => {
        if (error instanceof DressCodeAlreadyExistsError) {
          throw new ConflictException(error.message);
        }
        throw error;
      },
    });
  }
}
