import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import { ConflictException, NotFoundException } from '../../../../libs/exceptions';
import { DressCodeAlreadyExistsError, DressNotFoundError } from '../../domain/dress.errors';
import { UpdateDressCommand } from './update-dress.command';
import { UpdateDressRequestDto } from './update-dress.request.dto';
import { UpdateDressResult } from './update-dress.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class UpdateDressHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id')
  @RequirePermission('dress:update')
  @ApiOperation({ summary: 'Update a dress (partial; omitted fields are kept)' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({ status: 404, description: 'Dress not found' })
  @ApiResponse({ status: 409, description: 'New dress code already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDressRequestDto,
  ): Promise<IdResponse> {
    const result: UpdateDressResult = await this.commandBus.execute(
      new UpdateDressCommand({
        dressId: id,
        code: body.code,
        name: body.name,
        sizeLabel: body.sizeLabel,
        rentalPrice: body.rentalPrice,
        depositAmount: body.depositAmount,
        notes: body.notes,
        photoUrls: body.photoUrls,
      }),
    );

    return match(result, {
      Ok: (dressId) => new IdResponse(dressId),
      Err: (error: Error) => {
        if (error instanceof DressNotFoundError) {
          throw new NotFoundException(error.message);
        }
        if (error instanceof DressCodeAlreadyExistsError) {
          throw new ConflictException(error.message);
        }
        throw error;
      },
    });
  }
}
