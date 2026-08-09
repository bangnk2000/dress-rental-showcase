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
import { SubjectAttributes } from '../../../../libs/authz/authz.types';
import { CurrentSubject } from '../../../../libs/authz/current-subject.decorator';
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import {
  LateFeeWaiverNotAllowedError,
  LateFeeWaiverNoteRequiredError,
  RentalNotFoundError,
  RentalReturnNotAllowedError,
} from '../../domain/rental.errors';
import { ReturnRentalCommand } from './return-rental.command';
import { ReturnRentalOutcomeDto } from './return-rental.outcome.dto';
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
  @ApiOperation({
    summary:
      'Return a rental: settle the deposit and record late/damage fees. Omitting lateFee charges the suggested late fee (FR-RENT-09)',
  })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: ReturnRentalOutcomeDto,
    description:
      'Business rejection: rejected_rental_not_found | rejected_return_not_allowed (carries currentStatus) | rejected_waiver_note_required (carries suggested + submitted late fee)',
  })
  @ApiResponse({
    status: 403,
    type: ReturnRentalOutcomeDto,
    description:
      'Named denial: forbidden + reason late_fee_waiver_requires_owner — staff may not charge less than the suggested late fee',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid settlement body' })
  async settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnRentalRequestDto,
    @CurrentSubject() subject: SubjectAttributes,
  ): Promise<IdResponse> {
    const result: ReturnRentalResult = await this.commandBus.execute(
      new ReturnRentalCommand({
        rentalId: id,
        lateFee: body.lateFee ?? null,
        damageFee: body.damageFee ?? null,
        depositRefund: body.depositRefund ?? null,
        note: body.note ?? null,
        actorRole: subject.role,
      }),
    );

    return match(result, {
      Ok: (rentalId) => new IdResponse(rentalId),
      Err: (error: Error) => {
        if (error instanceof RentalNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_rental_not_found' });
        }
        if (error instanceof RentalReturnNotAllowedError) {
          throw new BusinessOutcomeException({
            status: 'rejected_return_not_allowed',
            currentStatus: error.currentStatus,
          });
        }
        // A denial NAMED in the use-case spec → 403 outcome body, not the guard envelope
        // (ADR 0001 §2 arbitration).
        if (error instanceof LateFeeWaiverNotAllowedError) {
          throw new BusinessOutcomeException(
            {
              status: 'forbidden',
              reason: 'late_fee_waiver_requires_owner',
              suggestedLateFee: error.suggestedLateFee,
              submittedLateFee: error.submittedLateFee,
            },
            403,
          );
        }
        if (error instanceof LateFeeWaiverNoteRequiredError) {
          throw new BusinessOutcomeException({
            status: 'rejected_waiver_note_required',
            suggestedLateFee: error.suggestedLateFee,
            submittedLateFee: error.submittedLateFee,
          });
        }
        throw error;
      },
    });
  }
}
