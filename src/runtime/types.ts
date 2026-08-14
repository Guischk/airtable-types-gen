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
 * Useful for create operations where computed fields should be excluded.
 *
 * The readonly-ness of a property is not observable from its value type —
 * `T[P] extends Readonly<T[P]>` is true for every P, which is why the previous
 * implementation always evaluated to `{}`. Comparing the property through two
 * otherwise-identical mapped types, one with the modifier stripped, is the only
 * way to detect it.
 */
export type WritableOnly<T> = {
  [P in keyof T as IsReadonlyKey<T, P> extends true ? never : P]: T[P];
};

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
