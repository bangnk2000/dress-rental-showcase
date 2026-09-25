import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PhotoUploadSignerPort,
  SignedPhotoUpload,
  SignPhotoUploadInput,
} from '../application/ports/photo-upload-signer.port';

export interface R2SignerConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/**
 * The ONLY file allowed to import `@aws-sdk/*` (dependency-cruiser `aws-sdk-only-in-r2-adapter`,
 * docs/design/catalog/dress-photo-upload.md §2 R2). Creating the S3Client opens no connection —
 * presigning is pure HMAC over the request, so boot and `openapi:emit` stay offline.
 */
export class R2PhotoUploadSignerAdapter implements PhotoUploadSignerPort {
  private readonly client: S3Client;

  constructor(
    private readonly config: R2SignerConfig,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      // `<account>.r2.cloudflarestorage.com/<bucket>/<key>` (as the design doc §6.Q8 names it),
      // not the SDK's default virtual-hosted `<bucket>.<account>…` host.
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Default "flexible checksums" would sign a CRC32 of the EMPTY presign body into the URL
      // (x-amz-checksum-crc32), which no real file matches. Only when an operation requires it.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  isConfigured(): boolean {
    return true;
  }

  async sign(input: SignPhotoUploadInput): Promise<SignedPhotoUpload> {
    const issuedAt = this.now();
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
      CacheControl: input.cacheControl,
    });
    // Without `signableHeaders` the presigner signs only content-length (+host); cache-control is
    // on SigV4's never-signed list unless named. Signing all three makes storage reject a PUT
    // whose type, size or caching header differs from what was declared here (R1).
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
      signingDate: issuedAt,
      signableHeaders: new Set(['content-type', 'content-length', 'cache-control']),
    });
    return {
      uploadUrl,
      // Content-Length is signed too but NOT returned: browsers refuse to set it (forbidden header)
      // and derive it from the File body — R2 rejects a body whose length differs from the signed
      // one (verified by the 2026-09-25 spike). Cache-Control is dropped unless signed AND sent.
      headers: {
        'Content-Type': input.contentType,
        'Cache-Control': input.cacheControl,
      },
      expiresAt: new Date(issuedAt.getTime() + input.expiresInSeconds * 1000),
    };
  }
}
