import { Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { match } from 'oxide.ts';
import { SubjectAttributes } from '../../../../libs/authz/authz.types';
import { CurrentSubject } from '../../../../libs/authz/current-subject.decorator';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { BusinessOutcomeException } from '../../../../libs/exceptions';
import {
  ListingDeleteOwnerOnlyError,
  ListingNotFoundError,
} from '../../domain/dress-listing.errors';
import { DeleteListingCommand } from './delete-listing.command';
import {
  DeleteListingOutcomeDto,
  ListingDeleteForbiddenOutcomeDto,
} from './delete-listing.outcome.dto';
import { DeleteListingResult } from './delete-listing.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'listings', version: '1' })
export class DeleteListingHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('listing:manage')
  @ApiOperation({
    summary:
      'Delete a listing (owner: any; staff: only a listing that was never published). Dresses are untouched.',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiResponse({
    status: 422,
    type: DeleteListingOutcomeDto,
    description: 'Business rejection: rejected_listing_not_found',
  })
  @ApiResponse({
    status: 403,
    type: ListingDeleteForbiddenOutcomeDto,
    description:
      'Named denial: forbidden + reason listing_published_owner_only — staff may not delete a listing that was ever published',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentSubject() subject: SubjectAttributes,
  ): Promise<void> {
    const result: DeleteListingResult = await this.commandBus.execute(
      new DeleteListingCommand({ listingId: id, actorRole: subject.role }),
    );

    return match(result, {
      Ok: () => undefined,
      Err: (error: Error) => {
        if (error instanceof ListingNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_listing_not_found' });
        }
        if (error instanceof ListingDeleteOwnerOnlyError) {
          // A denial NAMED in the use-case spec → 403 outcome body, not the guard envelope.
          throw new BusinessOutcomeException(
            { status: 'forbidden', reason: 'listing_published_owner_only' },
            403,
          );
        }
        throw error;
      },
    });
  }
}
