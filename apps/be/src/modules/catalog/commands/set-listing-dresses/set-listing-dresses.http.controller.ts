import { Body, Controller, Param, ParseUUIDPipe, Put } from '@nestjs/common';
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
  ListingDressesNotFoundError,
  ListingNotFoundError,
} from '../../domain/dress-listing.errors';
import { SetListingDressesCommand } from './set-listing-dresses.command';
import { SetListingDressesOutcomeDto } from './set-listing-dresses.outcome.dto';
import { SetListingDressesRequestDto } from './set-listing-dresses.request.dto';
import { SetListingDressesResult } from './set-listing-dresses.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'listings', version: '1' })
export class SetListingDressesHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':id/dresses')
  @RequirePermission('listing:manage')
  @ApiOperation({ summary: 'Replace the set of dresses attached to a listing' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: SetListingDressesOutcomeDto,
    description:
      'Business rejection: rejected_listing_not_found | rejected_dress_not_found (carries dressIds)',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
  async setDresses(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetListingDressesRequestDto,
  ): Promise<IdResponse> {
    const result: SetListingDressesResult = await this.commandBus.execute(
      new SetListingDressesCommand({ listingId: id, dressIds: body.dressIds }),
    );

    return match(result, {
      Ok: (listingId) => new IdResponse(listingId),
      Err: (error: Error) => {
        if (error instanceof ListingNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_listing_not_found' });
        }
        if (error instanceof ListingDressesNotFoundError) {
          throw new BusinessOutcomeException({
            status: 'rejected_dress_not_found',
            dressIds: error.dressIds,
          });
        }
        throw error;
      },
    });
  }
}
