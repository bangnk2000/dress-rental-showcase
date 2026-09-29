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
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import { ListingSlugTakenError } from '../../domain/dress-listing.errors';
import { CreateListingCommand } from './create-listing.command';
import { CreateListingOutcomeDto } from './create-listing.outcome.dto';
import { CreateListingRequestDto } from './create-listing.request.dto';
import { CreateListingResult } from './create-listing.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'listings', version: '1' })
export class CreateListingHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @RequirePermission('listing:manage')
  @ApiOperation({ summary: 'Create a public listing (draft) — FR-CAT-09' })
  @ApiCreatedResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: CreateListingOutcomeDto,
    description: 'Business rejection: rejected_listing_slug_taken (carries slug)',
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description: 'Invalid body: slug format, 0 / unknown / repeated styles, negative price',
  })
  async create(@Body() body: CreateListingRequestDto): Promise<IdResponse> {
    const result: CreateListingResult = await this.commandBus.execute(
      new CreateListingCommand({
        name: body.name,
        slug: body.slug,
        tagline: body.tagline ?? '',
        description: body.description ?? '',
        styles: body.styles,
        retailPrice: body.retailPrice ?? null,
        specs: {
          material: body.specs?.material ?? null,
          silhouette: body.specs?.silhouette ?? null,
          length: body.specs?.length ?? null,
          color: body.specs?.color ?? null,
          stylesText: body.specs?.stylesText ?? null,
        },
        photoUrls: body.photoUrls ?? [],
        isHot: body.isHot ?? false,
      }),
    );

    return match(result, {
      Ok: (id) => new IdResponse(id),
      Err: (error: Error) => {
        if (error instanceof ListingSlugTakenError) {
          throw new BusinessOutcomeException({
            status: 'rejected_listing_slug_taken',
            slug: error.slug,
          });
        }
        throw error;
      },
    });
  }
}
