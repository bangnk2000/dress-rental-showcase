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
import {
  ListingNotFoundError,
  ListingNotPublishableError,
} from '../../domain/dress-listing.errors';
import { PublishListingCommand } from './publish-listing.command';
import { PublishListingOutcomeDto } from './publish-listing.outcome.dto';
import { PublishListingResult } from './publish-listing.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'listings', version: '1' })
export class PublishListingHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('listing:manage')
  @ApiOperation({
    summary: 'Publish a listing on the website (idempotent; needs a photo and an active dress)',
  })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: PublishListingOutcomeDto,
    description:
      'Business rejection: rejected_listing_not_found | rejected_listing_not_publishable (carries missing[])',
  })
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<IdResponse> {
    const result: PublishListingResult = await this.commandBus.execute(
      new PublishListingCommand({ listingId: id }),
    );

    return match(result, {
      Ok: (listingId) => new IdResponse(listingId),
      Err: (error: Error) => {
        if (error instanceof ListingNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_listing_not_found' });
        }
        if (error instanceof ListingNotPublishableError) {
          throw new BusinessOutcomeException({
            status: 'rejected_listing_not_publishable',
            missing: error.missing,
          });
        }
        throw error;
      },
    });
  }
}
