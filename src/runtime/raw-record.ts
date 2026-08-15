import type { FieldSet, Record, Records } from 'airtable';

/**
 * An Airtable record as the REST API sends it.
 *
 * Generated schemas describe this shape, because it is what
 * `GET /v0/{baseId}/{tableId}` returns. The `airtable` SDK does *not* hand it
 * back: its `Record` exposes `id` and `fields` but keeps `createdTime` on
 * `_rawJson`, so validating an SDK record directly always fails on that key.
 */
export interface RawRecord<T extends FieldSet = FieldSet> {
  id: string;
  createdTime: string;
  fields: T;
}

/**
 * Rebuild the wire shape from an `airtable` SDK record, so it can be validated
 * against a generated schema.
 *
 * @example
 * ```typescript
 * const record = await base('Users').find('recXXXXXX');
 * const user = UsersSchema.parse(toRawRecord(record));
 * ```
 */
export const toRawRecord = <T extends FieldSet>(record: Record<T>): RawRecord<T> => {
  // `_rawJson` is the SDK's own storage for the untouched response. Reaching
  // into it is the reason this adapter exists: it is undocumented and typed
  // `any`, so consumers should not have to depend on it themselves.
  const raw = (record as unknown as { _rawJson?: { createdTime?: string } })._rawJson;

  if (!raw?.createdTime) {
    throw new Error(
      `toRawRecord: record ${record.id} carries no createdTime. This happens when the ` +
        'record was constructed by hand rather than returned by the Airtable API.'
    );
  }

  // `fields` comes from the record rather than `_rawJson`, since the SDK keeps
  // it current across save()/patchUpdate() while the raw payload stays stale.
  return { id: record.id, createdTime: raw.createdTime, fields: record.fields };
};

/** Rebuild the wire shape for a list of SDK records. */
export const toRawRecords = <T extends FieldSet>(
  records: Record<T>[] | Records<T>
): RawRecord<T>[] => (records as ReadonlyArray<Record<T>>).map((record) => toRawRecord(record));
