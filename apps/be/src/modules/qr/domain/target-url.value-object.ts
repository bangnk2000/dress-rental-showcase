import { DomainPrimitive, ValueObject } from '../../../libs/ddd/value-object.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';

/** A QR must carry a safe, absolute web URL; it is never fetched by this context. */
export class TargetUrl extends ValueObject<string> {
  static create(value: string): TargetUrl {
    if (value.length === 0 || value.length > 2048) {
      throw new ArgumentInvalidException('Target URL must be between 1 and 2048 characters');
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new ArgumentInvalidException('Target URL must be an absolute http(s) URL');
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) {
      throw new ArgumentInvalidException('Target URL must be an absolute http(s) URL without credentials');
    }
    return new TargetUrl({ value });
  }

  protected validate({ value }: DomainPrimitive<string>): void {
    if (!value) {
      throw new ArgumentInvalidException('Target URL must not be empty');
    }
  }
}
