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
import { SubjectAttributes } from '../../../../libs/authz/authz.types';
import { CurrentSubject } from '../../../../libs/authz/current-subject.decorator';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import {
  CancelBasisChangedError,
  CancelRetentionNotAllowedError,
  CancelRetentionNoteRequiredError,
  RefundExceedsCollectedError,
  RentalCancelHasPaymentsError,
  RentalCancelNotAllowedError,
  RentalNotFoundError,
} from '../../domain/rental.errors';
import { CancelRentalCommand } from './cancel-rental.command';
import { CancelRentalOutcomeDto } from './cancel-rental.outcome.dto';
import { CancelRentalRequestDto } from './cancel-rental.request.dto';
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
      'Cancel a rental — frees the calendar, keeps history. A booked rental with money on file is cancelled WITH refunds (body); an out rental only with an empty ledger',
  })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: CancelRentalOutcomeDto,
    description:
      'Business rejection: rejected_rental_not_found | rejected_cancel_not_allowed (currentStatus) | rejected_cancel_has_payments | rejected_cancel_basis_changed (collectedDeposit, collectedRentalFee) | rejected_refund_exceeds_collected (refundKind, collected, submitted) | rejected_retention_note_required (retainedAmount)',
  })
  @ApiResponse({
    status: 403,
    type: CancelRentalOutcomeDto,
    description:
      'Named denial: forbidden + reason cancel_retention_requires_owner (retainedAmount) — staff may only cancel with full refunds',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid cancel body' })
  // Optional on the wire too: a body-less cancel is the empty-ledger cancel it always was.
  @ApiBody({ type: CancelRentalRequestDto, required: false })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelRentalRequestDto,
    @CurrentSubject() subject: SubjectAttributes,
  ): Promise<IdResponse> {
    const result: CancelRentalResult = await this.commandBus.execute(
      new CancelRentalCommand({
        rentalId: id,
        expectedDepositCollected: body?.expectedDepositCollected ?? null,
        expectedRentalFeeCollected: body?.expectedRentalFeeCollected ?? null,
        depositRefund: body?.depositRefund ?? null,
        rentalFeeRefund: body?.rentalFeeRefund ?? null,
        note: body?.note ?? null,
        actorRole: subject.role,
      }),
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
        if (error instanceof CancelBasisChangedError) {
          throw new BusinessOutcomeException({
            status: 'rejected_cancel_basis_changed',
            collectedDeposit: error.collectedDeposit,
            collectedRentalFee: error.collectedRentalFee,
          });
        }
        if (error instanceof RefundExceedsCollectedError) {
          throw new BusinessOutcomeException({
            status: 'rejected_refund_exceeds_collected',
            refundKind: error.kind,
            collected: error.collected,
            submitted: error.submitted,
          });
        }
        // A denial NAMED in the use-case spec → 403 outcome body, not the guard envelope
        // (ADR 0001 §2 arbitration), same as the late-fee waiver.
        if (error instanceof CancelRetentionNotAllowedError) {
          throw new BusinessOutcomeException(
            {
              status: 'forbidden',
              reason: 'cancel_retention_requires_owner',
              retainedAmount: error.retainedAmount,
            },
            403,
          );
        }
        if (error instanceof CancelRetentionNoteRequiredError) {
          throw new BusinessOutcomeException({
            status: 'rejected_retention_note_required',
            retainedAmount: error.retainedAmount,
          });
        }
        throw error;
      },
    });
  }
}
