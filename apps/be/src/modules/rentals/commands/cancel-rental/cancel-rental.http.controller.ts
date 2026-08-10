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
import { BusinessOutcomeException } from '../../../../libs/exceptions';
import {
  RentalCancelHasPaymentsError,
  RentalCancelNotAllowedError,
  RentalNotFoundError,
} from '../../domain/rental.errors';
import { CancelRentalCommand } from './cancel-rental.command';
import { CancelRentalOutcomeDto } from './cancel-rental.outcome.dto';
import { CancelRentalResult } from './cancel-rental.service';

@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class CancelRentalHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rental:cancel')
  @ApiOperation({
    summary:
      'Cancel a booked or out rental with an EMPTY ledger — frees the calendar, keeps history',
  })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: CancelRentalOutcomeDto,
    description:
      'Business rejection: rejected_rental_not_found | rejected_cancel_not_allowed (carries currentStatus) | rejected_cancel_has_payments',
  })
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<IdResponse> {
    const result: CancelRentalResult = await this.commandBus.execute(
      new CancelRentalCommand({ rentalId: id }),
    );

    return match(result, {
      Ok: (rentalId) => new IdResponse(rentalId),
      Err: (error: Error) => {
        if (error instanceof RentalNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_rental_not_found' });
        }
        if (error instanceof RentalCancelNotAllowedError) {
          throw new BusinessOutcomeException({
            status: 'rejected_cancel_not_allowed',
            currentStatus: error.currentStatus,
          });
        }
        if (error instanceof RentalCancelHasPaymentsError) {
          throw new BusinessOutcomeException({ status: 'rejected_cancel_has_payments' });
        }
        throw error;
      },
    });
  }
}
