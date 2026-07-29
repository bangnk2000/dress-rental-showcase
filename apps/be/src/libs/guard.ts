export class Guard {
  static isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  }

  static lengthIsBetween(value: string, min: number, max: number): boolean {
    const n = value.trim().length;
    return n >= min && n <= max;
  }

  static isPositiveInteger(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }
}
