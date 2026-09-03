import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import {
  ApiErrorResponseDto,
  BusinessOutcomeException,
} from '../../../../libs/exceptions';
import {
  DressUnavailableError,
  RentalDressNotFoundError,
  RentalDressRetiredError,
} from '../../domain/rental.errors';
import { CreateRentalCommand } from './create-rental.command';
import { CreateRentalOutcomeDto } from './create-rental.outcome.dto';
import { CreateRentalRequestDto } from './create-rental.request.dto';
import { CreateRentalResult } from './create-rental.service';

@ApiTags('rentals')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class CreateRentalHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @RequirePermission('rental:create')
  @ApiOperation({ summary: 'Create a rental booking 1..n dresses for a date range' })
  @ApiCreatedResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: CreateRentalOutcomeDto,
    description:
      'Business rejection: rejected_dress_not_found | rejected_dress_retired | rejected_dress_unavailable (overlap incl. cleaning buffer, pre-check AND race)',
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description: 'Invalid request body (incl. a discount above the sum of the item prices)',
  })
  async create(@Body() body: CreateRentalRequestDto): Promise<IdResponse> {
    const result: CreateRentalResult = await this.commandBus.execute(
      new CreateRentalCommand({
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        startDate: body.startDate,
        endDate: body.endDate,
        notes: body.notes ?? null,
        discountAmount: body.discountAmount ?? 0,
        items: body.items.map((item) => ({
          dressId: item.dressId,
          price: item.price ?? null,
        })),
      }),
    );

    return match(result, {
      Ok: (id) => new IdResponse(id),
      Err: (error: Error) => {
        // Returned domain error = business outcome. Each rejection keeps its own code so the form
        // can say WHICH dress and WHY (ADR 0001 §3); dressIds is the outcome payload.
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
        throw error; // unexpected: the global filter renders GENERIC.INTERNAL
      },
    });
  }
}
