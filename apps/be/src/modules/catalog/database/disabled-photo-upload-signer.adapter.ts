import {
  PhotoUploadSignerPort,
  SignedPhotoUpload,
} from '../application/ports/photo-upload-signer.port';

/** Bound when the R2 env is incomplete: the app boots, only the upload endpoint answers 503. */
export class DisabledPhotoUploadSignerAdapter implements PhotoUploadSignerPort {
  isConfigured(): boolean {
    return false;
  }

  sign(): Promise<SignedPhotoUpload> {
    return Promise.reject(new Error('Photo storage is not configured (R2_* env missing)'));
  }
}
