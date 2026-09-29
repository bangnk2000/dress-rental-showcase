import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export interface ListingSpecsInput {
  material: string | null;
  silhouette: string | null;
  length: string | null;
  color: string | null;
  stylesText: string | null;
}

export class CreateListingCommand extends Command {
  readonly name: string;
  /** undefined = derive from the name. */
  readonly slug?: string;
  readonly tagline: string;
  readonly description: string;
  readonly styles: string[];
  readonly retailPrice: number | null;
  readonly specs: ListingSpecsInput;
  readonly photoUrls: string[];
  readonly isHot: boolean;

  constructor(props: CommandProps<CreateListingCommand>) {
    super(props);
    this.name = props.name;
    this.slug = props.slug;
    this.tagline = props.tagline;
    this.description = props.description;
    this.styles = props.styles;
    this.retailPrice = props.retailPrice;
    this.specs = props.specs;
    this.photoUrls = props.photoUrls;
    this.isHot = props.isHot;
  }
}
