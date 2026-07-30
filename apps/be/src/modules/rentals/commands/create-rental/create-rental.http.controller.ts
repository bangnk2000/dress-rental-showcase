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
import { ConflictException, NotFoundException } from '../../../../libs/exceptions';
import {
  DressUnavailableError,
  RentalDressNotFoundError,
  RentalDressRetiredError,
} from '../../domain/rental.errors';
import { CreateRentalCommand } from './create-rental.command';
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
  @ApiResponse({ status: 404, description: 'A dress in the rental does not exist' })
  @ApiResponse({
    status: 409,
    description:
      'A dress is retired, or already booked for an overlapping period (rental + cleaning buffer)',
  })
  async create(@Body() body: CreateRentalRequestDto): Promise<IdResponse> {
    const result: CreateRentalResult = await this.commandBus.execute(
      new CreateRentalCommand({
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        startDate: body.startDate,
        endDate: body.endDate,
        notes: body.notes ?? null,
        items: body.items.map((item) => ({
          dressId: item.dressId,
          price: item.price ?? null,
        })),
      }),
    );

    return match(result, {
      Ok: (id) => new IdResponse(id),
      Err: (error: Error) => {
        if (error instanceof RentalDressNotFoundError) {
          throw new NotFoundException(error.message);
        }
        if (
          error instanceof RentalDressRetiredError ||
          error instanceof DressUnavailableError
        ) {
          throw new ConflictException(error.message);
        }
        throw error;
      },
    });
  }
}
