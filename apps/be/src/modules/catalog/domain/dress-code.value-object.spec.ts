import { DressCode } from './dress-code.value-object';

describe('DressCode', () => {
  it('normalizes to uppercase and accepts dashes and underscores', () => {
    expect(DressCode.create(' vd-012 ').unpack()).toBe('VD-012');
    expect(DressCode.create('vd-012_1').unpack()).toBe('VD-012_1');
  });

  it.each(['V', 'VD 012', '-VD', 'VD-0123456789012345678'])('rejects %p', (value) => {
    expect(() => DressCode.create(value)).toThrow(/Dress code/);
  });

  describe('duplicate numbering (FR-CAT-08)', () => {
    it('baseOf strips only a trailing _<digits> suffix', () => {
      expect(DressCode.baseOf('VD-012')).toBe('VD-012');
      expect(DressCode.baseOf('VD-012_0')).toBe('VD-012');
      expect(DressCode.baseOf('VD-012_17')).toBe('VD-012');
      // ANY trailing _<digits> is read as a copy number — the convention has no escape hatch.
      expect(DressCode.baseOf('VD_012')).toBe('VD');
      expect(DressCode.baseOf('VD-012_A')).toBe('VD-012_A');
    });

    it('starts at _1 when no copy exists yet', () => {
      expect(DressCode.nextDuplicateOf('VD-012', ['VD-012']).unpack()).toBe('VD-012_1');
    });

    it('numbers max + 1, ignoring foreign prefixes and non-numeric suffixes', () => {
      const taken = ['VD-012', 'VD-012_0', 'VD-012_3', 'VD-0120_9', 'VD-012_X', 'VD-013_5'];
      expect(DressCode.nextDuplicateOf('VD-012', taken).unpack()).toBe('VD-012_4');
    });

    it('fills no gaps: a deleted _1 does not get reused while _2 exists', () => {
      expect(DressCode.nextDuplicateOf('VD-012', ['VD-012_0', 'VD-012_2']).unpack()).toBe(
        'VD-012_3',
      );
    });
  });
});
