import { z } from 'zod';

/**
 * Utility functions for working with Zod schemas generated from Airtable
 */

/**
 * Validates a record against a Zod schema and returns typed data
 */
export const validateRecord = <T>(schema: z.ZodType<T>, data: unknown): T => {
  return schema.parse(data);
};

/**
 * Safely validates a record and returns result with success flag
 */
export const safeValidateRecord = <T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
};

/**
 * Validates multiple records in batch
 */
export const validateRecords = <T>(schema: z.ZodType<T>, records: unknown[]): T[] => {
  return records.map((record) => schema.parse(record));
};

/**
 * Safely validates multiple records, filtering out invalid ones
 */
export const safeValidateRecords = <T>(
  schema: z.ZodType<T>,
  records: unknown[]
): { valid: T[]; invalid: { index: number; data: unknown; error: z.ZodError }[] } => {
  const valid: T[] = [];
  const invalid: { index: number; data: unknown; error: z.ZodError }[] = [];

  records.forEach((record, index) => {
    const result = schema.safeParse(record);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ index, data: record, error: result.error });
    }
  });

  return { valid, invalid };
};

/**
 * Creates a partial schema for updates: every field becomes optional.
 *
 * Uses `.partial()` rather than rebuilding the shape by hand — Zod 4 exposes
 * `_def`/shape entries differently, and `.partial()` behaves identically on
 * both majors.
 */
export const createUpdateSchema = <T extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>
): z.ZodObject<any> => baseSchema.partial() as unknown as z.ZodObject<any>;

/**
 * Creates a creation schema (excludes computed/readonly fields)
 */
export const createCreationSchema = <T extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>,
  readonlyFields: string[] = []
): z.ZodObject<any> => {
  const mask: Record<string, true> = {};
  for (const key of Object.keys(baseSchema.shape)) {
    if (readonlyFields.includes(key)) {
      mask[key] = true;
    }
  }

  return baseSchema.omit(mask as any) as unknown as z.ZodObject<any>;
};

/**
 * Utility type for extracting the type from a Zod schema
 */
export type InferZodType<T> = T extends z.ZodType<infer U> ? U : never;

/**
 * Utility type for creating update types (all fields optional)
 */
export type UpdateType<T> = Partial<T>;

/**
 * Utility type for creating creation types (excluding readonly fields)
 */
export type CreateType<T, K extends keyof T = never> = Omit<T, K>;

/**
 * Helper to format Zod validation errors in a readable way
 */
export const formatZodError = (error: z.ZodError): string => {
  // `issues` is the canonical field on both majors; Zod 3 also aliased it as
  // `errors`, which Zod 4 dropped. Read `issues` and fall back for safety.
  const issues: { path: PropertyKey[]; message: string }[] =
    error.issues ?? (error as unknown as { errors: typeof error.issues }).errors ?? [];

  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join(', ');
};

/**
 * Creates a validator function from a Zod schema
 */
export const createValidator = <T>(schema: z.ZodType<T>) => {
  return {
    validate: (data: unknown): T => schema.parse(data),
    safeValidate: (data: unknown) => safeValidateRecord(schema, data),
    validateMany: (data: unknown[]): T[] => validateRecords(schema, data),
    safeValidateMany: (data: unknown[]) => safeValidateRecords(schema, data),
  };
};

/**
 * Utility for creating Airtable-specific schemas with common patterns
 */
export const airtableSchemaHelpers = {
  /**
   * Creates a record ID field (always required string)
   */
  recordId: () => z.string().min(1, 'Record ID is required'),

  /**
   * Creates a timestamp field (ISO string)
   */
  timestamp: () => z.string().datetime('Must be a valid ISO datetime string'),

  /**
   * Creates an attachment field
   */
  attachment: () =>
    z.object({
      id: z.string(),
      url: z.string().url(),
      filename: z.string(),
      size: z.number().positive(),
      type: z.string(),
    }),

  /**
   * Creates a user field (Airtable user format)
   */
  user: () =>
    z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
    }),

  /**
   * Creates a linked record field (array of IDs)
   */
  linkedRecords: () => z.array(z.string()),

  /**
   * Creates an optional field with null/undefined handling
   */
  optional: <T>(schema: z.ZodType<T>) => schema.optional().nullable(),
};
