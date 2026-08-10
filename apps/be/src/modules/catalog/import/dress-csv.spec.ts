import { parseCsvRecords, parseDressCsv, parseVndAmount } from './dress-csv';

describe('parseCsvRecords (RFC4180 subset Google Sheets emits)', () => {
  it('handles quoted commas, escaped quotes and newlines inside quotes', () => {
    const records = parseCsvRecords(
      'a,"b,1","say ""hi""","line1\nline2"\r\nc,d,e,f\n',
    );
    expect(records).toEqual([
      ['a', 'b,1', 'say "hi"', 'line1\nline2'],
      ['c', 'd', 'e', 'f'],
    ]);
  });

  it('strips a BOM and drops fully-empty trailing records', () => {
    const records = parseCsvRecords('﻿' + 'x,y\n1,2\n\n');
    expect(records).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});

describe('parseVndAmount', () => {
  it('accepts vi thousand separators and currency marks', () => {
    expect(parseVndAmount('1.500.000')).toBe(1_500_000);
    expect(parseVndAmount('2,000,000')).toBe(2_000_000);
    expect(parseVndAmount('900000 ₫')).toBe(900_000);
    expect(parseVndAmount('123')).toBe(123);
  });

  it('rejects non-numeric values', () => {
    expect(parseVndAmount('')).toBeNull();
    expect(parseVndAmount('abc')).toBeNull();
    expect(parseVndAmount('1tr5')).toBeNull();
  });
});

describe('parseDressCsv', () => {
  const HEADER = 'code,name,size,rental_price,deposit,notes';

  it('maps rows; blank size/notes become null; vi prices are normalized', () => {
    const { rows, errors } = parseDressCsv(
      `${HEADER}\n` +
        `VD-101,"Váy cưới ren trắng, đuôi dài",M,"1.500.000","3.000.000",Hàng mới\n` +
        `VD-102,Đầm dạ hội đỏ,,900000,2000000,\n`,
    );
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        record: 2,
        code: 'VD-101',
        name: 'Váy cưới ren trắng, đuôi dài',
        sizeLabel: 'M',
        rentalPrice: 1_500_000,
        depositAmount: 3_000_000,
        notes: 'Hàng mới',
        category: null,
      },
      {
        record: 3,
        code: 'VD-102',
        name: 'Đầm dạ hội đỏ',
        sizeLabel: null,
        rentalPrice: 900_000,
        depositAmount: 2_000_000,
        notes: null,
        category: null,
      },
    ]);
  });

  it('an optional category column rides along as a NAME (blank = null)', () => {
    const { rows, errors } = parseDressCsv(
      'code,name,rental_price,deposit,category\nVD-201,Váy A,1000000,2000000,Dạ hội\nVD-202,Váy B,1000000,2000000,\n',
    );

    expect(errors).toEqual([]);
    expect(rows.map((row) => row.category)).toEqual(['Dạ hội', null]);
  });

  it('accepts the header in any order and case', () => {
    const { rows, errors } = parseDressCsv('NAME,CODE,DEPOSIT,RENTAL_PRICE\nĐầm,VD-1,2,1\n');
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ code: 'VD-1', name: 'Đầm', rentalPrice: 1, depositAmount: 2 });
  });

  it('fails fast on a wrong header instead of importing garbage', () => {
    const { rows, errors } = parseDressCsv('ma_vay,ten\nVD-1,Đầm\n');
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('missing column(s)');
    expect(errors[0]!.message).toContain('unknown column(s)');
  });

  it('reports bad rows by record number and keeps importing the good ones', () => {
    const { rows, errors } = parseDressCsv(
      `${HEADER}\n` +
        `VD-201,Đầm A,,100,200,\n` +
        `,Thiếu mã,,100,200,\n` +
        `VD-202,Đầm B,,khong-phai-gia,200,\n` +
        `VD-203,Đầm C,,100,200\n` + // 5 fields instead of 6
        `VD-204,Đầm D,,100,200,\n`,
    );
    expect(rows.map((row) => row.code)).toEqual(['VD-201', 'VD-204']);
    expect(errors).toEqual([
      { record: 3, message: 'Missing code' },
      { record: 4, message: "Bad rental_price: 'khong-phai-gia'" },
      { record: 5, message: 'Expected 6 fields, got 5' },
    ]);
  });

  it('reports an empty file', () => {
    const { rows, errors } = parseDressCsv('');
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ record: 0, message: 'Empty file (no header row)' }]);
  });
});
