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
import { SubjectAttributes } from '../../../../libs/authz/authz.types';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { IdResponse } from '../../../../libs/ddd/id.response.dto';
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import { CurrentSubject } from '../../../../libs/authz/current-subject.decorator';
import { CategoryNotFoundError } from '../../domain/category.errors';
import {
  DressCodeAlreadyExistsError,
  PurchasePriceOwnerOnlyError,
} from '../../domain/dress.errors';
import { PurchasePriceForbiddenOutcomeDto } from '../../dtos/purchase-price-forbidden.outcome.dto';
import { CreateDressCommand } from './create-dress.command';
import { CreateDressOutcomeDto } from './create-dress.outcome.dto';
import { CreateDressRequestDto } from './create-dress.request.dto';
import { CreateDressResult } from './create-dress.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class CreateDressHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @RequirePermission('dress:create')
  @ApiOperation({ summary: 'Add a dress to the catalog' })
  @ApiCreatedResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: CreateDressOutcomeDto,
    description:
      'Business rejection: rejected_dress_code_taken (carries dressCode) | rejected_category_not_found',
  })
  @ApiResponse({
    status: 403,
    type: PurchasePriceForbiddenOutcomeDto,
    description:
      'Named denial: forbidden + reason purchase_price_owner_only — staff may not set the purchase price (FR-CAT-05)',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
  async create(
    @Body() body: CreateDressRequestDto,
    @CurrentSubject() subject: SubjectAttributes,
  ): Promise<IdResponse> {
    const result: CreateDressResult = await this.commandBus.execute(
      new CreateDressCommand({
        code: body.code,
        name: body.name,
        sizeLabel: body.sizeLabel ?? null,
        rentalPrice: body.rentalPrice,
        depositAmount: body.depositAmount,
        notes: body.notes ?? null,
        photoUrls: body.photoUrls ?? [],
        categoryId: body.categoryId ?? null,
        purchasePrice: body.purchasePrice ?? null,
        actorRole: subject.role,
        actorId: subject.staffId,
      }),
    );

    return match(result, {
      Ok: (id) => new IdResponse(id),
      Err: (error: Error) => {
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
