import { Command, CommandProps } from '../../../../libs/ddd/command.base';

/** Partial update: `undefined` = keep; explicit `null` clears a nullable field / spec cell. */
export class UpdateListingCommand extends Command {
  readonly listingId: string;
  readonly name?: string;
  readonly slug?: string;
  readonly tagline?: string;
  readonly description?: string;
  readonly occasions?: string[];
  readonly retailPrice?: number | null;
  readonly specs?: {
    material?: string | null;
    silhouette?: string | null;
    length?: string | null;
    color?: string | null;
    occasionsText?: string | null;
  };
  readonly photoUrls?: string[];
  readonly isHot?: boolean;

  constructor(props: CommandProps<UpdateListingCommand>) {
    super(props);
    this.listingId = props.listingId;
    this.name = props.name;
    this.slug = props.slug;
    this.tagline = props.tagline;
    this.description = props.description;
    this.occasions = props.occasions;
    this.retailPrice = props.retailPrice;
    this.specs = props.specs;
    this.photoUrls = props.photoUrls;
    this.isHot = props.isHot;
  }
}
