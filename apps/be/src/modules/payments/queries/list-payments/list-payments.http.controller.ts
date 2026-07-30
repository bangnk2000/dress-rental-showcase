import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotFoundException } from '../../../../libs/exceptions';
import { PaymentListResponseDto } from './list-payments.response.dto';
import { ListPaymentsQuery } from './list-payments.query';

/**
 * Payments-owned read nested under the rental path: the money movements of a
 * rental belong to the payments context even though the URL reads as a rental
 * sub-resource (same trick as rentals' reads under /dresses).
 */
@ApiTags('payments')
@ApiBearerAuth()
@Controller({ path: 'rentals', version: '1' })
export class ListPaymentsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':rentalId/payments')
  @ApiOperation({ summary: 'The money movements of a rental (deposit refund, fees)' })
  @ApiOkResponse({ type: PaymentListResponseDto })
  @ApiResponse({ status: 404, description: 'Rental not found' })
  async list(
    @Param('rentalId', ParseUUIDPipe) rentalId: string,
  ): Promise<PaymentListResponseDto> {
    const result: PaymentListResponseDto | null = await this.queryBus.execute(
      new ListPaymentsQuery({ rentalId }),
    );
    if (!result) {
      throw new NotFoundException('Rental not found');
    }
    return result;
  }
}
