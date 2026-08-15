import { AirtableField } from '../types.js';

/**
 * What Airtable leaves behind when a cell is empty.
 *
 * The API never sends an empty cell — it drops the key entirely, and documents
 * which values count as empty:
 *
 *   "Returned records do not include any fields with 'empty' values,
 *    e.g. "", [], or false."
 *   — https://airtable.com/developers/web/api/list-records
 *
 * So for those types the omission is not missing information: it *is* the
 * value, compressed. Restoring it invents nothing, and spares every consumer a
 * guard on a field that can only ever hold one thing when absent.
 *
 * The rule stops exactly where the documentation does. `0` is not in that list,
 * so an absent number is genuinely unknown rather than zero; an absent date is
 * not the epoch, and an absent single-select is not the first choice. Those
 * stay optional.
 */
export interface EmptyValue {
  /** Zod literal restoring what Airtable omitted, e.g. `''`, `[]`, `false`. */
  literal: string;
  /**
   * True when the field's own validation would reject that literal.
   *
   * `z.string().email()` does not accept `''`, and Zod 3 validates the value
   * passed to `.default()` where Zod 4 hands it back untouched — so without
   * widening, the same generated schema throws on one major and not the other.
   * Widening also keeps parsing idempotent: a schema has to accept the `''` it
   * just produced.
   */
  widenToEmpty: boolean;
}

/** Airtable sends `""` for these, so an omission means the empty string. */
const EMPTY_STRING_TYPES = ['singleLineText', 'multilineText', 'richText'] as const;

/** Also empty-string types, but their own validation rejects `''`. */
const VALIDATED_STRING_TYPES = ['email', 'url', 'phoneNumber'] as const;

/** Airtable sends `[]` for these, so an omission means the empty array. */
const EMPTY_ARRAY_TYPES = [
  'multipleSelects',
  'multipleAttachments',
  'multipleRecordLinks',
  'multipleCollaborators',
  'lookup',
  'multipleLookupValues',
] as const;

const includes = (types: readonly string[], type: string): boolean => types.includes(type);

export const emptyValueFor = (field: AirtableField): EmptyValue | undefined => {
  if (includes(EMPTY_STRING_TYPES, field.type)) {
    return { literal: "''", widenToEmpty: false };
  }

  if (includes(VALIDATED_STRING_TYPES, field.type)) {
    return { literal: "''", widenToEmpty: true };
  }

  if (includes(EMPTY_ARRAY_TYPES, field.type)) {
    return { literal: '[]', widenToEmpty: false };
  }

  if (field.type === 'checkbox') {
    return { literal: 'false', widenToEmpty: false };
  }

  return undefined;
};
