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
  RentalNotFoundError,
  RentalPickupNotAllowedError,
} from '../../domain/rental.errors';
import { PickupRentalCommand } from './pickup-rental.command';
import { PickupRentalResult } from './pickup-rental.service';

@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class PickupRentalHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/pickup')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rental:pickup')
  @ApiOperation({ summary: 'Mark a booked rental as handed out to the customer' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({ status: 404, description: 'Rental not found' })
  @ApiResponse({ status: 409, description: 'Rental is not in the booked status' })
  async pickup(@Param('id', ParseUUIDPipe) id: string): Promise<IdResponse> {
    const result: PickupRentalResult = await this.commandBus.execute(
      new PickupRentalCommand({ rentalId: id }),
    );

    return match(result, {
      Ok: (rentalId) => new IdResponse(rentalId),
      Err: (error: Error) => {
        if (error instanceof RentalNotFoundError) {
          throw new NotFoundException(error.message);
        }
        if (error instanceof RentalPickupNotAllowedError) {
          throw new ConflictException(error.message);
        }
        throw error;
      },
    });
  }
}
