import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export interface PhotoUploadFile {
  readonly contentType: string;
  readonly contentLength: number;
}

/**
 * FR-CAT-10 (docs/design/catalog/dress-photo-upload.md §2, §9): sign one direct browser → R2 PUT
 * per file, for every photo of ONE form submit in one call. Writes nothing — an unused URL simply
 * expires.
 */
export class CreatePhotoUploadUrlCommand extends Command {
  readonly files: readonly PhotoUploadFile[];

  constructor(props: CommandProps<CreatePhotoUploadUrlCommand>) {
    super(props);
    this.files = props.files;
  }
}
