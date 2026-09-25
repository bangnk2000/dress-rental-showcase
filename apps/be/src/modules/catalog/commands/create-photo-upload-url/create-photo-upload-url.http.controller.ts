import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from '../../../../libs/authz/require-permission.decorator';
import { ApiErrorResponseDto } from '../../../../libs/exceptions';
import { CreatePhotoUploadUrlCommand } from './create-photo-upload-url.command';
import { CreatePhotoUploadUrlRequestDto } from './create-photo-upload-url.request.dto';
import {
  CreatePhotoUploadUrlResponseDto,
  PhotoUploadHeadersDto,
} from './create-photo-upload-url.response.dto';
import { PhotoUploadUrl } from './create-photo-upload-url.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller({ path: 'photos', version: '1' })
export class CreatePhotoUploadUrlHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('upload-urls')
  @RequirePermission('photo:upload')
  @ApiOperation({
    summary:
      'Presign ONE direct browser → R2 PUT (300 s; Content-Type, Content-Length and Cache-Control are signed)',
  })
  @ApiCreatedResponse({ type: CreatePhotoUploadUrlResponseDto })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description:
      'PHOTO.UNSUPPORTED_TYPE (not JPEG/PNG/WebP) | PHOTO.TOO_LARGE (details[0].maxBytes) | GENERIC.VALIDATION',
  })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: 'GENERIC.FORBIDDEN' })
  @ApiResponse({
    status: 503,
    type: ApiErrorResponseDto,
    description: 'PHOTO.STORAGE_UNAVAILABLE — R2 is not configured on this server',
  })
  async create(
    @Body() body: CreatePhotoUploadUrlRequestDto,
  ): Promise<CreatePhotoUploadUrlResponseDto> {
    const signed: PhotoUploadUrl = await this.commandBus.execute(
      new CreatePhotoUploadUrlCommand({
        contentType: body.contentType,
        contentLength: body.contentLength,
      }),
    );
    return Object.assign(new CreatePhotoUploadUrlResponseDto(), {
      uploadUrl: signed.uploadUrl,
      method: signed.method,
      headers: Object.assign(new PhotoUploadHeadersDto(), signed.headers),
      url: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
    });
  }
}
