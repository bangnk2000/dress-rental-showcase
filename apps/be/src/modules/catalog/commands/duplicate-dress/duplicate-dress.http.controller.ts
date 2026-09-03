import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
import { CurrentSubject } from '../../../../libs/authz/current-subject.decorator';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { ApiErrorResponseDto, BusinessOutcomeException } from '../../../../libs/exceptions';
import { DressCodeAlreadyExistsError, DressNotFoundError } from '../../domain/dress.errors';
import { DuplicateDressCommand } from './duplicate-dress.command';
import { DuplicateDressOutcomeDto } from './duplicate-dress.outcome.dto';
import { DuplicateDressRequestDto } from './duplicate-dress.request.dto';
import { DuplicateDressResponseDto } from './duplicate-dress.response.dto';
import { DuplicateDressResult } from './duplicate-dress.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'dresses', version: '1' })
export class DuplicateDressHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/duplicate')
  @RequirePermission('dress:create') // a duplicate IS a create
  @ApiOperation({
    summary:
      'Duplicate a dress under the next free <code>_<n> (n from 1), optionally in another size',
  })
  @ApiCreatedResponse({ type: DuplicateDressResponseDto })
  @ApiResponse({
    status: 422,
    type: DuplicateDressOutcomeDto,
    description:
      'Business rejection: rejected_dress_not_found | rejected_dress_code_taken (numbering race lost repeatedly; carries dressCode)',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request body' })
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DuplicateDressRequestDto,
    @CurrentSubject() subject: SubjectAttributes,
  ): Promise<DuplicateDressResponseDto> {
    const result: DuplicateDressResult = await this.commandBus.execute(
      new DuplicateDressCommand({
        sourceDressId: id,
        sizeLabel: body.sizeLabel,
        actorId: subject.staffId,
      }),
    );

    return match(result, {
      Ok: (copy) => Object.assign(new DuplicateDressResponseDto(), copy),
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
        throw error;
      },
    });
  }
}
