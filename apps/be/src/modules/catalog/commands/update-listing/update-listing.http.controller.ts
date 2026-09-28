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
  ListingNotFoundError,
  ListingPhotoRequiredError,
  ListingSlugLockedError,
  ListingSlugTakenError,
} from '../../domain/dress-listing.errors';
import { UpdateListingCommand } from './update-listing.command';
import { UpdateListingOutcomeDto } from './update-listing.outcome.dto';
import { UpdateListingRequestDto } from './update-listing.request.dto';
import { UpdateListingResult } from './update-listing.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'listings', version: '1' })
export class UpdateListingHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id')
  @RequirePermission('listing:manage')
  @ApiOperation({ summary: 'Update a listing (partial; omitted fields are kept)' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: UpdateListingOutcomeDto,
    description:
      'Business rejection: rejected_listing_not_found | rejected_listing_slug_taken (carries slug) | rejected_listing_slug_locked | rejected_listing_photo_required',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateListingRequestDto,
  ): Promise<IdResponse> {
    const result: UpdateListingResult = await this.commandBus.execute(
      new UpdateListingCommand({
        listingId: id,
        name: body.name,
        slug: body.slug,
        tagline: body.tagline,
        description: body.description,
        occasions: body.occasions,
        retailPrice: body.retailPrice,
        specs: body.specs && {
          material: body.specs.material,
          silhouette: body.specs.silhouette,
          length: body.specs.length,
          color: body.specs.color,
          occasionsText: body.specs.occasionsText,
        },
        photoUrls: body.photoUrls,
        isHot: body.isHot,
      }),
    );

    return match(result, {
      Ok: (listingId) => new IdResponse(listingId),
      Err: (error: Error) => {
        if (error instanceof ListingNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_listing_not_found' });
        }
        if (error instanceof ListingSlugTakenError) {
          throw new BusinessOutcomeException({
            status: 'rejected_listing_slug_taken',
            slug: error.slug,
          });
        }
        if (error instanceof ListingSlugLockedError) {
          throw new BusinessOutcomeException({ status: 'rejected_listing_slug_locked' });
        }
        if (error instanceof ListingPhotoRequiredError) {
          throw new BusinessOutcomeException({ status: 'rejected_listing_photo_required' });
        }
        throw error;
      },
    });
  }
}
