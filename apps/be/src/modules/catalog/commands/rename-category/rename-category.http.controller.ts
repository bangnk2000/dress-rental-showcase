import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
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
import { CategoryNameTakenError, CategoryNotFoundError } from '../../domain/category.errors';
import { CreateCategoryRequestDto } from '../create-category/create-category.request.dto';
import { RenameCategoryCommand } from './rename-category.command';
import { RenameCategoryOutcomeDto } from './rename-category.outcome.dto';
import { RenameCategoryResult } from './rename-category.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'categories', version: '1' })
export class RenameCategoryHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('category:update')
  @ApiOperation({ summary: 'Rename a category (any staff); dresses keep their assignment' })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: RenameCategoryOutcomeDto,
    description: 'Business rejection: rejected_category_not_found | rejected_category_name_taken',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
  async rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCategoryRequestDto,
  ): Promise<IdResponse> {
    const result: RenameCategoryResult = await this.commandBus.execute(
      new RenameCategoryCommand({ categoryId: id, name: body.name }),
    );

    return match(result, {
      Ok: (categoryId) => new IdResponse(categoryId),
      Err: (error: Error) => {
        if (error instanceof CategoryNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_category_not_found' });
        }
        if (error instanceof CategoryNameTakenError) {
          throw new BusinessOutcomeException({
            status: 'rejected_category_name_taken',
            name: error.name,
          });
        }
        throw error;
      },
    });
  }
}
