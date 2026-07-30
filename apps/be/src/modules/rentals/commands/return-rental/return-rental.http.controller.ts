import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
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
import {
  RentalNotFoundError,
  RentalReturnNotAllowedError,
} from '../../domain/rental.errors';
import { ReturnRentalCommand } from './return-rental.command';
import { ReturnRentalRequestDto } from './return-rental.request.dto';
import { ReturnRentalResult } from './return-rental.service';

@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class ReturnRentalHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rental:return')
  @ApiOperation({ summary: 'Return a rental: settle the deposit and record late/damage fees' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({ status: 404, description: 'Rental not found' })
  @ApiResponse({ status: 409, description: 'Rental is already returned or cancelled' })
  async settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnRentalRequestDto,
  ): Promise<IdResponse> {
    const result: ReturnRentalResult = await this.commandBus.execute(
      new ReturnRentalCommand({
        rentalId: id,
        lateFee: body.lateFee ?? null,
        damageFee: body.damageFee ?? null,
        depositRefund: body.depositRefund ?? null,
        note: body.note ?? null,
      }),
    );

    return match(result, {
      Ok: (rentalId) => new IdResponse(rentalId),
      Err: (error: Error) => {
        if (error instanceof RentalNotFoundError) {
          throw new NotFoundException(error.message);
        }
        if (error instanceof RentalReturnNotAllowedError) {
          throw new ConflictException(error.message);
        }
        throw error;
      },
    });
  }
}
