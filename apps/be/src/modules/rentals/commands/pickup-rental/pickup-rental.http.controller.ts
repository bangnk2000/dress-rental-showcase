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
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import {
  DepositNotCollectedError,
  PickupDepositAlreadyRecordedError,
  RentalNotFoundError,
  RentalPickupNotAllowedError,
} from '../../domain/rental.errors';
import { PickupRentalCommand } from './pickup-rental.command';
import { PickupRentalOutcomeDto } from './pickup-rental.outcome.dto';
import { PickupRentalRequestDto } from './pickup-rental.request.dto';
import { PickupRentalResult } from './pickup-rental.service';

@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class PickupRentalHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/pickup')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rental:pickup')
  @ApiOperation({
    summary:
      'Hand a booked rental out to the customer — only with a deposit on file or collected now (FR-RENT-14)',
  })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: PickupRentalOutcomeDto,
    description:
      'Business rejection: rejected_rental_not_found | rejected_pickup_not_allowed (carries currentStatus) | rejected_deposit_not_collected | rejected_deposit_already_recorded (recordedAmount)',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid pickup body' })
  // Optional on the wire too: a body-less pickup is the normal case when a deposit is on file.
  @ApiBody({ type: PickupRentalRequestDto, required: false })
  async pickup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PickupRentalRequestDto,
  ): Promise<IdResponse> {
    const result: PickupRentalResult = await this.commandBus.execute(
      new PickupRentalCommand({ rentalId: id, depositCollected: body?.depositCollected ?? null }),
    );

    return match(result, {
      Ok: (rentalId) => new IdResponse(rentalId),
      Err: (error: Error) => {
        if (error instanceof RentalNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_rental_not_found' });
        }
        if (error instanceof RentalPickupNotAllowedError) {
          throw new BusinessOutcomeException({
            status: 'rejected_pickup_not_allowed',
            currentStatus: error.currentStatus,
          });
        }
        if (error instanceof DepositNotCollectedError) {
          throw new BusinessOutcomeException({ status: 'rejected_deposit_not_collected' });
        }
        if (error instanceof PickupDepositAlreadyRecordedError) {
          throw new BusinessOutcomeException({
            status: 'rejected_deposit_already_recorded',
            recordedAmount: error.recordedAmount,
          });
        }
        throw error;
      },
    });
  }
}
