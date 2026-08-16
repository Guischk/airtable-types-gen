import { AirtableBaseSchema, AirtableTable } from '../types.js';
import { describe, literal, propertyKey, sanitizeComment } from './emit.js';
import { emptyValueFor } from './empty-value.js';
import { enrichFieldMetadata, resolvePropertyNames } from './schema.js';
import { mapAirtableTypeToZod, generateSchemaName, generateTypeName } from './zod-schema.js';

/**
 * Emit `key: expression,` plus its JSDoc line, at a given indent.
 *
 * The read and write paths compute *different* expressions for the same field —
 * that separation is the point — but they must render the key identically, or a
 * schema's keys stop lining up with the interface describing it.
 */
const emitEntry = (
  propertyName: string,
  expression: string,
  comment: string | undefined,
  indent: string
): string[] => {
  const lines: string[] = [];
  if (comment) {
    lines.push(`${indent}/** ${comment} */`);
  }
  lines.push(`${indent}${propertyKey(propertyName)}: ${expression},`);
  return lines;
};

/**
 * Read-path entry for one field. Shared by both structures so they cannot drift.
 */
const emitFieldEntry = (field: AirtableTable['fields'][number], propertyName: string): string[] => {
  const zodMapping = mapAirtableTypeToZod(field);
  const emptyValue = emptyValueFor(field);

  let expression = zodMapping.expression;
  // Applied here rather than in the mapping so Zod and TypeScript output agree.
  if (enrichFieldMetadata(field).isReadonly) {
    expression += '.readonly()';
  }

  // Airtable omits every empty cell, so no field is guaranteed to arrive. Where
  // the omission encodes a known value we hand that value back; elsewhere the
  // field is simply absent.
  if (emptyValue) {
    if (emptyValue.widenToEmpty) {
      expression += `.or(z.literal(${emptyValue.literal}))`;
    }
    expression += `.default(${emptyValue.literal})`;
  } else {
    expression += '.optional()';
  }

  return emitEntry(
    propertyName,
    expression,
    describe(field.description, zodMapping.description),
    '  '
  );
};

/** The one literal every generated Zod module opens with. */
export const ZOD_IMPORT = "import { z } from 'zod';";

/**
 * How a write payload is laid out, per structure — chosen once rather than
 * re-derived at each of the points that used to branch on `flatten`.
 *
 * Native writes reach Airtable as `{ id, fields }`, so the schema mirrors that.
 * The flattened one is keyed like the flattened record.
 *
 * `recordEntry` is a whole entry, not a key: it is interpolated into
 * `.extend({ … })`.
 */
const writeStructure = (flatten: boolean) =>
  flatten
    ? { nestUnderFields: false, recordEntry: 'record_id: z.string().optional()' }
    : { nestUnderFields: true, recordEntry: 'id: z.string()' };

/**
 * Emit the creation/update schemas for one table.
 *
 * Deliberately built from their own literal rather than derived from the read
 * schema. Deriving would carry the read schema's defaults onto the write path,
 * where they are actively harmful: an update payload that mentions one field
 * would arrive at Airtable carrying `''` and `false` for every other, blanking
 * cells the caller never touched. `.partial()` does not save us either — it
 * strips defaults on Zod 3 and keeps them on Zod 4, so the same code would
 * corrupt data on one major only.
 */
export const generateTableWritableZodSchema = (
  table: AirtableTable,
  flatten: boolean = false
): string => {
  const schemaName = generateSchemaName(table.name);
  const typeBase = schemaName.replace(/Schema$/, '');
  // Must match the read schema's keys for the same structure, or a caller that
  // reads a record and writes it back would be renaming fields in transit.
  const propertyNames = resolvePropertyNames(table, flatten);
  const { nestUnderFields, recordEntry } = writeStructure(flatten);
  const indent = nestUnderFields ? '    ' : '  ';
  const lines: string[] = [];

  lines.push('/**');
  lines.push(` * Writable fields of "${sanitizeComment(table.name)}".`);
  lines.push(' * Computed fields are excluded, and nothing is defaulted: a write must carry');
  lines.push(' * exactly what the caller set.');
  lines.push(' */');

  const entries = table.fields
    .filter((field) => !enrichFieldMetadata(field).isReadonly)
    .flatMap((field) => {
      const zodMapping = mapAirtableTypeToZod(field);
      return emitEntry(
        propertyNames.get(field.id)!,
        `${zodMapping.expression}.optional()`,
        describe(field.description, zodMapping.description),
        indent
      );
    });

  lines.push(`export const ${typeBase}WritableSchema = z.object({`);
  if (nestUnderFields) {
    lines.push('  fields: z.object({', ...entries, '  }),');
  } else {
    lines.push(...entries);
  }
  lines.push('});');
  lines.push('');
  lines.push(
    nestUnderFields
      ? '// Creation payload: every writable field optional, inside the `fields` wrapper'
      : '// Creation payload: writable fields only, all optional.'
  );
  lines.push(`export const ${typeBase}CreationSchema = ${typeBase}WritableSchema;`);
  lines.push(`export type ${typeBase}Creation = z.infer<typeof ${typeBase}CreationSchema>;`);
  lines.push('');
  lines.push('// Update payload: the same fields, plus the record being updated.');
  lines.push(
    `export const ${typeBase}UpdateSchema = ${typeBase}WritableSchema.extend({ ${recordEntry} });`
  );
  lines.push(`export type ${typeBase}Update = z.infer<typeof ${typeBase}UpdateSchema>;`);

  return lines.join('\n');
};

export const generateTableZodSchema = (
  table: AirtableTable,
  flatten: boolean = false,
  options?: { includeImport?: boolean }
): string => {
  const schemaName = generateSchemaName(table.name);
  const typeName = generateTypeName(table.name);
  const lines: string[] = [];

  // Add imports
  const includeImport = options?.includeImport ?? true;
  if (includeImport) {
    lines.push(ZOD_IMPORT);
    lines.push('');
  }

  // Add schema header comment
  lines.push('/**');
  lines.push(` * Zod schema for table "${sanitizeComment(table.name)}"`);
  lines.push(
    ` * @description ${sanitizeComment(table.description || `Table ${table.name} from Airtable`)}`
  );
  lines.push(' */');

  if (flatten) {
    // Generate flattened schema (all fields at root level)
    lines.push(`export const ${schemaName} = z.object({`);
    lines.push('  /** Unique Airtable record ID */');
    lines.push('  record_id: z.string(),');

    const propertyNames = resolvePropertyNames(table, true);

    table.fields.forEach((field) => {
      // Add empty line before property for readability
      lines.push('');
      lines.push(...emitFieldEntry(field, propertyNames.get(field.id)!));
    });

    lines.push('});');
  } else {
    // Generate standard Airtable schema (native structure)
    const fieldsSchemaName = `${schemaName}Fields`;

    // First, generate the Fields schema
    lines.push(`const ${fieldsSchemaName} = z.object({`);

    const propertyNames = resolvePropertyNames(table, false);

    table.fields.forEach((field, index) => {
      // Add empty line before property if we have previous fields
      if (index > 0) {
        lines.push('');
      }
      lines.push(...emitFieldEntry(field, propertyNames.get(field.id)!));
    });

    lines.push('});');
    lines.push('');

    // Then generate the main record schema
    lines.push(`export const ${schemaName} = z.object({`);
    lines.push('  /** Unique Airtable record ID */');
    lines.push('  id: z.string(),');
    lines.push('');
    lines.push('  /** Record fields */');
    lines.push(`  fields: ${fieldsSchemaName},`);
    lines.push('');
    lines.push('  /** Record creation time */');
    lines.push('  createdTime: z.string().datetime(),');
    lines.push('});');
  }

  // Add type inference export
  lines.push('');
  lines.push('/**');
  lines.push(` * Inferred TypeScript type for ${table.name}`);
  lines.push(' */');
  lines.push(`export type ${typeName} = z.infer<typeof ${schemaName}>;`);

  return lines.join('\n');
};

export const generateUtilityZodTypes = (
  schema: AirtableBaseSchema,
  options?: { flatten?: boolean }
): string => {
  const flatten = options?.flatten ?? false;
  const tableNames = schema.tables.map((table) => literal(table.name)).join(' | ');

  const tableNamesArray = schema.tables.map((table) => literal(table.name)).join(', ');

  const schemaExports = schema.tables
    .map((table) => {
      const schemaName = generateSchemaName(table.name);
      const typeName = generateTypeName(table.name);
      return `  ${literal(table.name)}: { schema: typeof ${schemaName}, type: ${typeName} };`;
    })
    .join('\n');

  const registryEntries = schema.tables
    .map((table) => `  ${literal(table.name)}: ${generateSchemaName(table.name)},`)
    .join('\n');

  // Always expose readonly field lists for each table (useful in both modes)
  const readonlyArraysBlock = schema.tables
    .map((table) => {
      const typeBase = generateSchemaName(table.name).replace(/Schema$/, '');
      const readonlyFields = table.fields
        .filter((f) => enrichFieldMetadata(f).isReadonly)
        .map((f) => literal(f.name))
        .join(', ');
      return `// Readonly fields for ${table.name}\nexport const ${typeBase}ReadonlyFields = [${readonlyFields}] as const;`;
    })
    .join('\n\n');

  // Write payloads, in both structures. They used to be flattened-only, which left
  // native-mode callers deriving writes from the record type — where every
  // field Airtable restores an empty value for is guaranteed, so required.
  const helpersBlock =
    '\n' +
    schema.tables.map((table) => generateTableWritableZodSchema(table, flatten)).join('\n\n');

  const base = `
/**
 * Union type of all available table names
 */
export type AirtableTableName = ${tableNames};

/**
 * Array of all available table names (runtime constant)
 * Allows iteration over table names at runtime
 */
export const AIRTABLE_TABLE_NAMES = [${tableNamesArray}] as const;

/**
 * Mapping of table names to their schemas and types
 */
export interface AirtableTableSchemas {
${schemaExports}
}

/**
 * Generic type to get the Zod schema for a table
 */
export type GetTableSchema<T extends AirtableTableName> = AirtableTableSchemas[T]['schema'];

/**
 * Generic type to get the TypeScript type for a table
 */
export type GetTableType<T extends AirtableTableName> = AirtableTableSchemas[T]['type'];

/**
 * Runtime registry of every generated schema, keyed by table name.
 */
export const AIRTABLE_SCHEMAS = {
${registryEntries}
} as const;

/**
 * Validate an unknown payload against the schema of a given table.
 */
export const validateTableRecord = <T extends AirtableTableName>(
  tableName: T,
  data: unknown
): GetTableType<T> => AIRTABLE_SCHEMAS[tableName].parse(data) as GetTableType<T>;
${readonlyArraysBlock ? `\n${readonlyArraysBlock}\n` : ''}
${helpersBlock ? `\n${helpersBlock}\n` : ''}
`;

  const extras = flatten
    ? `
/**
 * Flattens an Airtable record by extracting fields and adding the ID
 * Re-exported for convenience when using flattened Zod schemas
 */
export { flattenRecord } from 'airtable-types-gen/runtime';
`
    : '';

  return base + extras;
};

/**
 * A whole Zod module for a base: the import, every table's schema, then the
 * utility types.
 *
 * Mirrors `generateAllTypes` on the TypeScript side, so "what a Zod module
 * looks like" lives here rather than at the call site — where it was assembled
 * by hand, in three places that drifted.
 */
export const generateAllZodSchemas = (
  schema: AirtableBaseSchema,
  flatten: boolean = false
): string => {
  const schemas = schema.tables
    .map((table) => generateTableZodSchema(table, flatten, { includeImport: false }))
    .join('\n\n');

  return `${ZOD_IMPORT}\n\n` + schemas + generateUtilityZodTypes(schema, { flatten });
};
