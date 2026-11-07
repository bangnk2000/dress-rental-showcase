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
import {
  DressUnavailableError,
  RentalDressNotFoundError,
  RentalDressRetiredError,
  RentalNotFoundError,
  RentalUpdateNotAllowedError,
} from '../../domain/rental.errors';
import { UpdateRentalCommand } from './update-rental.command';
import { UpdateRentalOutcomeDto } from './update-rental.outcome.dto';
import { UpdateRentalRequestDto } from './update-rental.request.dto';
import { UpdateRentalResult } from './update-rental.service';

@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class UpdateRentalHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id')
  // Any staff (FR-RENT-13, owner decision 2026-11-07 — owner-only before); the policy stays so a
  // future narrowing is one line in rentals.policies.ts.
  @RequirePermission('rental:update')
  @ApiOperation({
    summary:
      'Edit an OPEN rental (any staff, FR-RENT-13): customer, dates, dresses, prices, discount, notes — partial; omitted fields are kept, items replace the list',
  })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: UpdateRentalOutcomeDto,
    description:
      'Business rejection: rejected_rental_not_found | rejected_update_not_allowed (carries currentStatus — returned/cancelled, pre-check or under the row lock) | rejected_dress_not_found | rejected_dress_retired (an ADDED dress) | rejected_dress_unavailable (new period incl. cleaning buffer overlaps another rental, pre-check AND race) — the dress codes carry dressIds',
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description:
      'Invalid request body (incl. an invalid date range or a discount above the sum of the new item prices)',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRentalRequestDto,
  ): Promise<IdResponse> {
    const result: UpdateRentalResult = await this.commandBus.execute(
      new UpdateRentalCommand({
        rentalId: id,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        startDate: body.startDate,
        endDate: body.endDate,
        notes: body.notes,
        discountAmount: body.discountAmount,
        items: body.items?.map((item) => ({ dressId: item.dressId, price: item.price ?? null })),
      }),
    );

    return match(result, {
      Ok: (rentalId) => new IdResponse(rentalId),
      Err: (error: Error) => {
        if (error instanceof RentalNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_rental_not_found' });
        }
        if (error instanceof RentalUpdateNotAllowedError) {
          throw new BusinessOutcomeException({
            status: 'rejected_update_not_allowed',
            currentStatus: error.currentStatus,
          });
        }
        if (error instanceof RentalDressNotFoundError) {
          throw new BusinessOutcomeException({
            status: 'rejected_dress_not_found',
            dressIds: error.dressIds,
          });
        }
        if (error instanceof RentalDressRetiredError) {
          throw new BusinessOutcomeException({
            status: 'rejected_dress_retired',
            dressIds: error.dressIds,
          });
        }
        if (error instanceof DressUnavailableError) {
          throw new BusinessOutcomeException({
            status: 'rejected_dress_unavailable',
            dressIds: error.dressIds,
          });
        }
        throw error;
      },
    });
  }
}
