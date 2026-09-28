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
import { ListingNotFoundError } from '../../domain/dress-listing.errors';
import { UnpublishListingCommand } from './unpublish-listing.command';
import { UnpublishListingOutcomeDto } from './unpublish-listing.outcome.dto';
import { UnpublishListingResult } from './unpublish-listing.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'listings', version: '1' })
export class UnpublishListingHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('listing:manage')
  @ApiOperation({
    summary: 'Hide a listing from the website (idempotent; the slug stays locked)',
  })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: UnpublishListingOutcomeDto,
    description: 'Business rejection: rejected_listing_not_found',
  })
  async unpublish(@Param('id', ParseUUIDPipe) id: string): Promise<IdResponse> {
    const result: UnpublishListingResult = await this.commandBus.execute(
      new UnpublishListingCommand({ listingId: id }),
    );

    return match(result, {
      Ok: (listingId) => new IdResponse(listingId),
      Err: (error: Error) => {
        if (error instanceof ListingNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_listing_not_found' });
        }
        throw error;
      },
    });
  }
}
