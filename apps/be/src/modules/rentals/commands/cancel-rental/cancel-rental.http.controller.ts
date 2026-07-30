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
import {
  RentalCancelNotAllowedError,
  RentalNotFoundError,
} from '../../domain/rental.errors';
import { CancelRentalCommand } from './cancel-rental.command';
import { CancelRentalResult } from './cancel-rental.service';

@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class CancelRentalHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rental:cancel')
  @ApiOperation({ summary: 'Cancel a booked rental — frees the calendar, keeps history' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({ status: 404, description: 'Rental not found' })
  @ApiResponse({ status: 409, description: 'Rental is not in the booked status' })
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<IdResponse> {
    const result: CancelRentalResult = await this.commandBus.execute(
      new CancelRentalCommand({ rentalId: id }),
    );

    return match(result, {
      Ok: (rentalId) => new IdResponse(rentalId),
      Err: (error: Error) => {
        if (error instanceof RentalNotFoundError) {
          throw new NotFoundException(error.message);
        }
        if (error instanceof RentalCancelNotAllowedError) {
          throw new ConflictException(error.message);
        }
        throw error;
      },
    });
  }
}
