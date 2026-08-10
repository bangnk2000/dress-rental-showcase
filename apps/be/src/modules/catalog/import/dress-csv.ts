/**
 * Parser for the shop's Google Sheets CSV export (one-time seed import).
 * Structural validation only — domain rules (code format, money bounds) stay
 * in the VOs and surface per-row when the import script dispatches commands.
 *
 * Expected header (any order, case-insensitive):
 *   code,name,size,rental_price,deposit,notes,category — size, notes, category optional.
 * Prices tolerate vi formatting: "1.500.000", "1,500,000", "1500000 ₫".
 * category is a NAME ('Dạ hội'); the import script resolves or auto-creates it (FR-CAT-07 §6.Q2).
 */

export interface DressCsvRow {
  /** Record number in the file (header = 1) — for error reporting. */
  record: number;
  code: string;
  name: string;
  sizeLabel: string | null;
  rentalPrice: number;
  depositAmount: number;
  notes: string | null;
  category: string | null;
}

export interface DressCsvError {
  /** Record number in the file (header = 1); 0 = file-level problem. */
  record: number;
  message: string;
}

export interface DressCsvResult {
  rows: DressCsvRow[];
  errors: DressCsvError[];
}

const KNOWN_HEADERS = ['code', 'name', 'size', 'rental_price', 'deposit', 'notes', 'category'];
const REQUIRED_HEADERS = ['code', 'name', 'rental_price', 'deposit'];

/** RFC4180: quoted fields may contain commas, newlines and escaped ("") quotes. */
export function parseCsvRecords(content: string): string[][] {
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content; // strip BOM
  const records: string[][] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    fields.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    records.push(fields);
    fields = [];
  };

  while (i < text.length) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      endField();
      i += 1;
      continue;
    }
    if (char === '\r' && text[i + 1] === '\n') {
      endRecord();
      i += 2;
      continue;
    }
    if (char === '\n' || char === '\r') {
      endRecord();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || fields.length > 0) endRecord();

  // A trailing newline produces one empty record — drop fully-empty records.
  return records.filter((record) => record.some((value) => value.trim().length > 0));
}

/** "1.500.000", "1,500,000", "1500000 ₫" → 1500000; anything non-numeric → null. */
export function parseVndAmount(value: string): number | null {
  const digits = value.replace(/[.,\s₫đ]/gi, '');
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}

export function parseDressCsv(content: string): DressCsvResult {
  const records = parseCsvRecords(content);
  const rows: DressCsvRow[] = [];
  const errors: DressCsvError[] = [];

  if (records.length === 0) {
    return { rows, errors: [{ record: 0, message: 'Empty file (no header row)' }] };
  }

  const header = records[0]!.map((value) => value.trim().toLowerCase());
  const unknown = header.filter((name) => !KNOWN_HEADERS.includes(name));
  const missing = REQUIRED_HEADERS.filter((name) => !header.includes(name));
  if (unknown.length > 0 || missing.length > 0) {
    // Wrong file shape — fail fast instead of importing garbage.
    const parts = [];
    if (missing.length > 0) parts.push(`missing column(s): ${missing.join(', ')}`);
    if (unknown.length > 0) parts.push(`unknown column(s): ${unknown.join(', ')}`);
    return { rows, errors: [{ record: 1, message: `Bad header — ${parts.join('; ')}` }] };
  }
  const column = (name: string) => header.indexOf(name);

  records.slice(1).forEach((record, index) => {
    const recordNumber = index + 2; // header is record 1
    if (record.length !== header.length) {
      errors.push({
        record: recordNumber,
        message: `Expected ${header.length} fields, got ${record.length}`,
      });
      return;
    }
    const cell = (name: string) => {
      const at = column(name);
      return at === -1 ? '' : record[at]!.trim();
    };

    const code = cell('code');
    const name = cell('name');
    const rentalPrice = parseVndAmount(cell('rental_price'));
    const depositAmount = parseVndAmount(cell('deposit'));

    if (!code) errors.push({ record: recordNumber, message: 'Missing code' });
    else if (!name) errors.push({ record: recordNumber, message: 'Missing name' });
    else if (rentalPrice === null)
      errors.push({ record: recordNumber, message: `Bad rental_price: '${cell('rental_price')}'` });
    else if (depositAmount === null)
      errors.push({ record: recordNumber, message: `Bad deposit: '${cell('deposit')}'` });
    else
      rows.push({
        record: recordNumber,
        code,
        name,
        sizeLabel: cell('size') || null,
        rentalPrice,
        depositAmount,
        notes: cell('notes') || null,
        category: cell('category') || null,
      });
  });

  return { rows, errors };
}
