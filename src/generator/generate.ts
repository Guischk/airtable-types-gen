/**
 * Turning a base schema into generated source, in one place.
 *
 * The assembly used to live at each call site — the CLI joined imports, schemas
 * and utility types by hand, `generateTypes` did its own thing, and the
 * multi-file path did a third. They drifted, which is how `--separate-files
 * --typescript-only` ended up emitting a smaller set of utility types than the
 * single-file run of the same base.
 *
 * So: everything above this module decides *where the bytes go*, and nothing
 * else. Fetching, environment resolution, writing to disk or stdout, progress
 * reporting — all of it stays outside. What is left here is pure, which is also
 * what makes it the surface the tests aim at.
 */
import {
  AirtableBaseSchema,
  GenerateOptions,
  GenerateResult,
  OutputFormat,
  OutputLayout,
} from '../types.js';
import { generateSeparateFiles } from './multi-file.js';
import { fetchBaseSchema } from './schema.js';
import { generateAllTypes } from './types.js';
import { generateAllZodSchemas } from './zod-generator.js';

/** Everything `generateFromSchema` needs. */
export interface GenerateFromSchemaOptions {
  /** The base schema to generate from. Fetching it is the caller's business. */
  schema: AirtableBaseSchema;
  /** Defaults to `'zod'`, matching the CLI. */
  format?: OutputFormat;
  /** Defaults to `false` (native Airtable structure). */
  flatten?: boolean;
  /** Table names to keep. Omitted or empty means every table. */
  tables?: string[];
  /** Defaults to `'single'`. */
  layout?: OutputLayout;
}

/** One module holding every table. */
export interface SingleFileOutput {
  layout: 'single';
  content: string;
  /** The schema actually generated from, after `tables` filtering. */
  schema: AirtableBaseSchema;
}

/** One module per table plus an `index.ts`, keyed by filename. */
export interface SeparateFilesOutput {
  layout: 'separate';
  files: Record<string, string>;
  /** The schema actually generated from, after `tables` filtering. */
  schema: AirtableBaseSchema;
}

export type GeneratedOutput = SingleFileOutput | SeparateFilesOutput;

const selectTables = (schema: AirtableBaseSchema, tables?: string[]): AirtableBaseSchema =>
  tables && tables.length > 0
    ? { tables: schema.tables.filter((table) => tables.includes(table.name)) }
    : schema;

const generateSingleFile = (
  schema: AirtableBaseSchema,
  format: OutputFormat,
  flatten: boolean
): string =>
  format === 'typescript'
    ? generateAllTypes(schema, flatten)
    : generateAllZodSchemas(schema, flatten);

export function generateFromSchema(
  options: GenerateFromSchemaOptions & { layout: 'separate' }
): SeparateFilesOutput;
export function generateFromSchema(
  options: GenerateFromSchemaOptions & { layout?: 'single' }
): SingleFileOutput;
export function generateFromSchema(options: GenerateFromSchemaOptions): GeneratedOutput;
export function generateFromSchema(options: GenerateFromSchemaOptions): GeneratedOutput {
  const { format = 'zod', flatten = false, layout = 'single' } = options;
  const schema = selectTables(options.schema, options.tables);

  if (layout === 'separate') {
    return {
      layout: 'separate',
      files: generateSeparateFiles(schema, { format, flatten }),
      schema,
    };
  }

  return { layout: 'single', content: generateSingleFile(schema, format, flatten), schema };
}

/**
 * Fetch a base schema and generate TypeScript interfaces from it.
 *
 * Predates `generateFromSchema` and is kept for the published API, so it stays
 * TypeScript-only and single-file. New callers should fetch the schema
 * themselves — `fetchBaseSchema` is exported too — and call
 * `generateFromSchema`, which can also emit Zod and separate files.
 */
export const generateTypes = async (options: GenerateOptions): Promise<GenerateResult> => {
  console.error('[Generator] Starting type generation...');

  const baseSchema = await fetchBaseSchema(options.baseId, options.token);

  const { content, schema } = generateFromSchema({
    schema: baseSchema,
    format: 'typescript',
    flatten: options.flatten,
    tables: options.tables,
  });

  console.error(`[Generator] Generated types for ${schema.tables.length} tables`);

  return { content, schema };
};
