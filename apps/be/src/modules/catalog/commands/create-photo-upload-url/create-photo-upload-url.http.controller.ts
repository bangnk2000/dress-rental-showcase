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
import { CreatePhotoUploadUrlsRequestDto } from './create-photo-upload-url.request.dto';
import {
  CreatePhotoUploadUrlsResponseDto,
  PhotoUploadHeadersDto,
  PhotoUploadUrlDto,
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
      'Presign one direct browser → R2 PUT per file, for all photos of one form submit (300 s; Content-Type, Content-Length and Cache-Control are signed)',
  })
  @ApiCreatedResponse({ type: CreatePhotoUploadUrlsResponseDto })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description:
      'PHOTO.UNSUPPORTED_TYPE | PHOTO.TOO_LARGE (details[0].maxBytes) — details[0].field = files.<i>.… names the file; GENERIC.VALIDATION',
  })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: 'GENERIC.FORBIDDEN' })
  @ApiResponse({
    status: 503,
    type: ApiErrorResponseDto,
    description: 'PHOTO.STORAGE_UNAVAILABLE — R2 is not configured on this server',
  })
  async create(
    @Body() body: CreatePhotoUploadUrlsRequestDto,
  ): Promise<CreatePhotoUploadUrlsResponseDto> {
    const signed: PhotoUploadUrl[] = await this.commandBus.execute(
      new CreatePhotoUploadUrlCommand({
        files: body.files.map(({ contentType, contentLength }) => ({ contentType, contentLength })),
      }),
    );
    return Object.assign(new CreatePhotoUploadUrlsResponseDto(), {
      uploads: signed.map((upload) =>
        Object.assign(new PhotoUploadUrlDto(), {
          uploadUrl: upload.uploadUrl,
          method: upload.method,
          headers: Object.assign(new PhotoUploadHeadersDto(), upload.headers),
          url: upload.url,
          expiresAt: upload.expiresAt.toISOString(),
        }),
      ),
    });
  }
}
