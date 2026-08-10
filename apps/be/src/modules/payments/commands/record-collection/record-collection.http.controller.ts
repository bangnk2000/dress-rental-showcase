import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
  CollectionAlreadyRecordedError,
  CollectionRentalNotFoundError,
  NothingToRecordError,
  RentalClosedError,
} from '../../domain/payment.errors';
import { RecordCollectionCommand } from './record-collection.command';
import { RecordCollectionOutcomeDto } from './record-collection.outcome.dto';
import { RecordCollectionRequestDto } from './record-collection.request.dto';
import { RecordCollectionResult } from './record-collection.service';

/**
 * Payments-owned command nested under the rental path: the money of a rental belongs to the
 * payments context even though the URL reads as a rental sub-resource (same trick as the read).
 */
@ApiTags('payments')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class RecordCollectionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':rentalId/payments/collect')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment:collect')
  @ApiOperation({
    summary: 'Record money COLLECTED for a rental: deposit and/or rental fee (FR-PAY-02)',
    description:
      'Writes 1..2 movements in one transaction. Returns the RENTAL id — the call creates several rows, so there is no single movement id.',
  })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: RecordCollectionOutcomeDto,
    description:
      'Business rejection: rejected_rental_not_found | rejected_rental_closed (currentStatus) | rejected_nothing_to_record | rejected_deposit_already_recorded (recordedAmount) | rejected_rental_fee_already_recorded (recordedAmount)',
  })
  async collect(
    @Param('rentalId', ParseUUIDPipe) rentalId: string,
    @Body() body: RecordCollectionRequestDto,
  ): Promise<IdResponse> {
    const result: RecordCollectionResult = await this.commandBus.execute(
      new RecordCollectionCommand({
        rentalId,
        deposit: body.deposit ?? null,
        rentalFee: body.rentalFee ?? null,
        note: body.note ?? null,
      }),
    );

    return match(result, {
      Ok: (id) => new IdResponse(id),
      Err: (error: Error) => {
        if (error instanceof CollectionRentalNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_rental_not_found' });
        }
        if (error instanceof RentalClosedError) {
          throw new BusinessOutcomeException({
            status: 'rejected_rental_closed',
            currentStatus: error.currentStatus,
          });
        }
        if (error instanceof NothingToRecordError) {
          throw new BusinessOutcomeException({ status: 'rejected_nothing_to_record' });
        }
        if (error instanceof CollectionAlreadyRecordedError) {
          throw new BusinessOutcomeException({
            status:
              error.kind === 'deposit'
                ? 'rejected_deposit_already_recorded'
                : 'rejected_rental_fee_already_recorded',
            recordedAmount: error.recordedAmount,
          });
        }
        throw error;
      },
    });
  }
}
