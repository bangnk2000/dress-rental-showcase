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
import { CategoryNameTakenError } from '../../domain/category.errors';
import { CreateCategoryCommand } from './create-category.command';
import { CreateCategoryOutcomeDto } from './create-category.outcome.dto';
import { CreateCategoryRequestDto } from './create-category.request.dto';
import { CreateCategoryResult } from './create-category.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'categories', version: '1' })
export class CreateCategoryHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @RequirePermission('category:create')
  @ApiOperation({ summary: 'Create a dress category (any staff)' })
  @ApiCreatedResponse({ type: IdResponse })
  @ApiResponse({
    status: 422,
    type: CreateCategoryOutcomeDto,
    description: 'Business rejection: rejected_category_name_taken (carries the trimmed name)',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
  async create(@Body() body: CreateCategoryRequestDto): Promise<IdResponse> {
    const result: CreateCategoryResult = await this.commandBus.execute(
      new CreateCategoryCommand({ name: body.name }),
    );

    return match(result, {
      Ok: (id) => new IdResponse(id),
      Err: (error: Error) => {
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
