import { Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
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
import { CategoryInUseError, CategoryNotFoundError } from '../../domain/category.errors';
import { DeleteCategoryCommand } from './delete-category.command';
import { DeleteCategoryOutcomeDto } from './delete-category.outcome.dto';
import { DeleteCategoryResult } from './delete-category.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'categories', version: '1' })
export class DeleteCategoryHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('category:delete')
  @ApiOperation({
    summary: 'Delete an EMPTY category (owner only); one still holding dresses is refused',
  })
  @ApiOkResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: DeleteCategoryOutcomeDto,
    description:
      'Business rejection: rejected_category_not_found | rejected_category_in_use (carries dressCount)',
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: 'Guard denial (GENERIC.FORBIDDEN): only the owner deletes categories',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<IdResponse> {
    const result: DeleteCategoryResult = await this.commandBus.execute(
      new DeleteCategoryCommand({ categoryId: id }),
    );

    return match(result, {
      Ok: (categoryId) => new IdResponse(categoryId),
      Err: (error: Error) => {
        if (error instanceof CategoryNotFoundError) {
          throw new BusinessOutcomeException({ status: 'rejected_category_not_found' });
        }
        if (error instanceof CategoryInUseError) {
          throw new BusinessOutcomeException({
            status: 'rejected_category_in_use',
            dressCount: error.dressCount,
          });
        }
        throw error;
      },
    });
  }
}
