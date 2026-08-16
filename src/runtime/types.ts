/**
 * Utility types for working with generated Airtable types
 * These are generic types that work with any generated table interface
 */

/**
 * Extract the table name from a record interface name
 * Example: UsersRecord -> 'Users'
 */
export type ExtractTableName<T extends string> = T extends `${infer U}Record` ? U : never;

/**
 * Make all properties of a type optional except the ID
 * Useful for creating partial updates while keeping ID required
 */
export type PartialExceptId<T extends { id: any }> = Partial<Omit<T, 'id'>> & Pick<T, 'id'>;

/**
 * Make all readonly properties writable
 * Useful for creating mock data or test fixtures
 */
export type Writable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Extract only the writable (non-readonly) properties from a type.
 *
 * The readonly-ness of a property is not observable from its value type —
 * `T[P] extends Readonly<T[P]>` is true for every P, which is why the previous
 * implementation always evaluated to `{}`. Comparing the property through two
 * otherwise-identical mapped types, one with the modifier stripped, is the only
 * way to detect it.
 *
 * @deprecated Not a create payload. It strips `readonly` and nothing else, so
 * every property the record type marks as guaranteed stays **required** — and
 * since 0.6.0 that is every field Airtable restores an empty value for. Passing
 * `WritableOnly<UsersRecord>` to a create asks the caller for the whole table.
 * Use the generated `…CreationSchema` / `…Creation` for a table, or
 * {@link CreatePayload} for a hand-written interface.
 */
export type WritableOnly<T> = {
  [P in keyof T as IsReadonlyKey<T, P> extends true ? never : P]: T[P];
};

/**
 * A create payload for `T`: writable properties only, all optional.
 *
 * The optionality is the contract, not a convenience. Airtable accepts a
 * partial write and leaves every field the caller omitted alone, so a create
 * type that demands the full record describes a request nobody makes.
 *
 * Prefer the generated `…CreationSchema` where there is one — it is built from
 * the field metadata rather than derived from a type, so it also carries the
 * per-field validation. This is for hand-written interfaces.
 */
export type CreatePayload<T> = Partial<{
  // Deliberately not `Partial<WritableOnly<T>>`: that would pin a live public
  // type to a deprecated one, and `WritableOnly` could never then be removed.
  [P in keyof T as IsReadonlyKey<T, P> extends true ? never : P]: T[P];
}>;

type IsReadonlyKey<T, P extends keyof T> =
  Equals<{ [K in P]: T[K] }, { -readonly [K in P]: T[K] }> extends true ? false : true;

type Equals<X, Y> =
  (<G>() => G extends X ? 1 : 2) extends <G>() => G extends Y ? 1 : 2 ? true : false;

/**
 * Generic type for Airtable API responses
 */
export interface AirtableResponse<T> {
  records: T[];
  offset?: string;
}

/**
 * Standard error response from Airtable API
 */
export interface AirtableError {
  error: {
    type: string;
    message: string;
  };
}

/**
 * Options for batch operations
 */
export interface BatchOptions {
  batchSize?: number;
  delayMs?: number;
}

/**
 * Type guard to check if a value is an Airtable error
 */
export const isAirtableError = (value: any): value is AirtableError => {
  return value && typeof value === 'object' && 'error' in value;
};
