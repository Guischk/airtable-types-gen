import { describe, it, expect } from 'vitest';
import { emptyValueFor } from '../../src/generator/empty-value';
import { ALL_FIELD_TYPES, TYPES_WITH_EMPTY_VALUE } from '../fixtures/field-types';
import { AirtableField } from '../../src/types';

const field = (type: string): AirtableField => ({ id: 'f', name: 'F', type });

describe('emptyValueFor', () => {
  it('gives the literal Airtable documents as empty for that type', () => {
    expect(emptyValueFor(field('singleLineText'))?.literal).toBe("''");
    expect(emptyValueFor(field('checkbox'))?.literal).toBe('false');
    expect(emptyValueFor(field('multipleRecordLinks'))?.literal).toBe('[]');
  });

  it('returns nothing when the omission carries no known value', () => {
    // 0 is not in Airtable's list of empty values, so an absent number is not 0.
    expect(emptyValueFor(field('number'))).toBeUndefined();
    expect(emptyValueFor(field('date'))).toBeUndefined();
    expect(emptyValueFor(field('singleSelect'))).toBeUndefined();
    expect(emptyValueFor(field('barcode'))).toBeUndefined();
    expect(emptyValueFor(field('autoNumber'))).toBeUndefined();
  });

  it('flags the types whose own validation would reject their empty value', () => {
    // `z.string().email()` rejects '', and Zod 3 validates defaults, so the
    // expression has to admit '' explicitly before `.default('')` can hand it back.
    for (const type of ['email', 'url', 'phoneNumber']) {
      expect(emptyValueFor(field(type))?.widenToEmpty, type).toBe(true);
    }

    for (const type of ['singleLineText', 'multilineText', 'richText', 'checkbox']) {
      expect(emptyValueFor(field(type))?.widenToEmpty, type).toBe(false);
    }
  });

  it('agrees with the fixture on every mapped field type', () => {
    for (const f of ALL_FIELD_TYPES) {
      const documented = TYPES_WITH_EMPTY_VALUE[f.type];
      const actual = emptyValueFor(f);

      if (documented === undefined) {
        expect(actual, f.type).toBeUndefined();
      } else {
        expect(actual, f.type).toBeDefined();
        expect(JSON.parse(actual!.literal.replace(/'/g, '"')), f.type).toEqual(documented);
      }
    }
  });
});
