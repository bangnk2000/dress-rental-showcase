import { Command, CommandProps } from '../../../../libs/ddd/command.base';

/**
 * FR-CAT-10 (docs/design/catalog/dress-photo-upload.md §2): sign ONE direct browser → R2 PUT.
 * Writes nothing — an unused URL simply expires.
 */
export class CreatePhotoUploadUrlCommand extends Command {
  readonly contentType: string;
  readonly contentLength: number;

  constructor(props: CommandProps<CreatePhotoUploadUrlCommand>) {
    super(props);
    this.contentType = props.contentType;
    this.contentLength = props.contentLength;
  }
}
