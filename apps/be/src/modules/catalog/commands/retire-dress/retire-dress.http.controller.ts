import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
import { DressAlreadyRetiredError, DressNotFoundError } from '../../domain/dress.errors';
import { RetireDressCommand } from './retire-dress.command';
import { RetireDressResult } from './retire-dress.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class RetireDressHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('dress:retire')
  @ApiOperation({ summary: 'Retire a dress (owner only; one-way in MVP)' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({ status: 403, description: 'Only the owner may retire a dress' })
  @ApiResponse({ status: 404, description: 'Dress not found' })
  @ApiResponse({ status: 409, description: 'Dress is already retired' })
  async retire(@Param('id', ParseUUIDPipe) id: string): Promise<IdResponse> {
    const result: RetireDressResult = await this.commandBus.execute(
      new RetireDressCommand({ dressId: id }),
    );

    return match(result, {
      Ok: (dressId) => new IdResponse(dressId),
      Err: (error: Error) => {
        if (error instanceof DressNotFoundError) {
          throw new NotFoundException(error.message);
        }
        if (error instanceof DressAlreadyRetiredError) {
          throw new ConflictException(error.message);
        }
        throw error;
      },
    });
  }
}
