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
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import { DressCodeAlreadyExistsError, DressNotFoundError } from '../../domain/dress.errors';
import { UpdateDressCommand } from './update-dress.command';
import { UpdateDressOutcomeDto } from './update-dress.outcome.dto';
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
  @ApiResponse({
    status: 422,
    type: UpdateDressOutcomeDto,
    description:
      'Business rejection: rejected_dress_not_found | rejected_dress_code_taken (carries dressCode)',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
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
          throw new BusinessOutcomeException({ status: 'rejected_dress_not_found' });
        }
        if (error instanceof DressCodeAlreadyExistsError) {
          throw new BusinessOutcomeException({
            status: 'rejected_dress_code_taken',
            dressCode: error.dressCode,
          });
        }
        throw error;
      },
    });
  }
}
