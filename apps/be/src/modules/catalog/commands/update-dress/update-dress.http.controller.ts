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
import { SubjectAttributes } from '../../../../libs/authz/authz.types';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import { CurrentSubject } from '../../../../libs/authz/current-subject.decorator';
import { CategoryNotFoundError } from '../../domain/category.errors';
import {
  DressCodeAlreadyExistsError,
  DressNotFoundError,
  PurchasePriceOwnerOnlyError,
} from '../../domain/dress.errors';
import { PurchasePriceForbiddenOutcomeDto } from '../../dtos/purchase-price-forbidden.outcome.dto';
import { UpdateDressCommand } from './update-dress.command';
import { UpdateDressOutcomeDto } from './update-dress.outcome.dto';
import { UpdateDressRequestDto } from './update-dress.request.dto';
import { UpdateDressResult } from './update-dress.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class UpdateDressHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id')
  @RequirePermission('dress:update')
  @ApiOperation({ summary: 'Update a dress (partial; omitted fields are kept)' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: UpdateDressOutcomeDto,
    description:
      'Business rejection: rejected_dress_not_found | rejected_dress_code_taken (carries dressCode) | rejected_category_not_found',
  })
  @ApiResponse({
    status: 403,
    type: PurchasePriceForbiddenOutcomeDto,
    description:
      'Named denial: forbidden + reason purchase_price_owner_only — staff may not set the purchase price (FR-CAT-05)',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDressRequestDto,
    @CurrentSubject() subject: SubjectAttributes,
  ): Promise<IdResponse> {
    const result: UpdateDressResult = await this.commandBus.execute(
      new UpdateDressCommand({
        dressId: id,
        code: body.code,
        name: body.name,
        sizeLabel: body.sizeLabel,
        rentalPrice: body.rentalPrice,
        depositAmount: body.depositAmount,
        notes: body.notes,
        photoUrls: body.photoUrls,
        categoryId: body.categoryId,
        purchasePrice: body.purchasePrice,
        actorRole: subject.role,
        actorId: subject.staffId,
      }),
    );

    return match(result, {
      Ok: (dressId) => new IdResponse(dressId),
      Err: (error: Error) => {
        if (error instanceof DressNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_dress_not_found' });
        }
        if (error instanceof DressCodeAlreadyExistsError) {
          throw new BusinessOutcomeException({
            status: 'rejected_dress_code_taken',
            dressCode: error.dressCode,
          });
        }
        if (error instanceof CategoryNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_category_not_found' });
        }
        if (error instanceof PurchasePriceOwnerOnlyError) {
          // A denial NAMED in the use-case spec → 403 outcome body, not the guard envelope.
          throw new BusinessOutcomeException(
            { status: 'forbidden', reason: 'purchase_price_owner_only' },
            403,
          );
        }
        throw error;
      },
    });
  }
}
