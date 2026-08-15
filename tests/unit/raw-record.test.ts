import { describe, it, expect } from 'vitest';
import type { FieldSet, Record as AirtableRecord } from 'airtable';
import { toRawRecord, toRawRecords } from '../../src/runtime/raw-record';

/**
 * The `airtable` SDK's Record exposes `id` and `fields` but not `createdTime` —
 * it only survives on the private-looking `_rawJson`. Generated schemas describe
 * the REST wire shape, which does carry it, so SDK records cannot be validated
 * without this adapter.
 */

const sdkRecord = (overrides: Record<string, unknown> = {}): AirtableRecord<FieldSet> =>
  ({
    id: 'recABC123',
    fields: { Name: 'Ada' },
    _rawJson: {
      id: 'recABC123',
      createdTime: '2026-08-15T10:00:00.000Z',
      fields: { Name: 'Ada' },
    },
    ...overrides,
  }) as unknown as AirtableRecord<FieldSet>;

describe('toRawRecord', () => {
  it('rebuilds the wire shape a generated schema expects', () => {
    expect(toRawRecord(sdkRecord())).toEqual({
      id: 'recABC123',
      createdTime: '2026-08-15T10:00:00.000Z',
      fields: { Name: 'Ada' },
    });
  });

  it('reads fields from the record rather than the raw payload', () => {
    // `record.fields` is what the SDK keeps up to date across save()/patch().
    const record = sdkRecord({ fields: { Name: 'Grace' } });

    expect(toRawRecord(record).fields).toEqual({ Name: 'Grace' });
  });

  it('fails loudly when the record carries no createdTime', () => {
    const record = sdkRecord({ _rawJson: { id: 'recABC123', fields: {} } });

    expect(() => toRawRecord(record)).toThrow(/createdTime/);
  });

  it('converts a list of records', () => {
    expect(toRawRecords([sdkRecord(), sdkRecord()])).toHaveLength(2);
  });
});
