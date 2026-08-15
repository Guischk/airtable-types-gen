import { AirtableBaseSchema, AirtableTable } from '../types.js';
import { describe, literal, propertyKey, sanitizeComment } from './emit.js';
import { emptyValueFor } from './empty-value.js';
import { enrichFieldMetadata, resolvePropertyNames } from './schema.js';
import { mapAirtableTypeToZod, generateSchemaName, generateTypeName } from './zod-schema.js';

/**
 * Emit the `  key: z.…,` entry (plus its JSDoc line) for one field.
 * Shared by the flattened and native shapes so the two cannot drift.
 */
const emitFieldEntry = (field: AirtableTable['fields'][number], propertyName: string): string[] => {
  const lines: string[] = [];
  const zodMapping = mapAirtableTypeToZod(field);
  const enrichedField = enrichFieldMetadata(field);
  const emptyValue = emptyValueFor(field);

  const comment = describe(field.description, zodMapping.description);
  if (comment) {
    lines.push(`  /** ${comment} */`);
  }

  let expression = zodMapping.expression;
  // Applied here rather than in the mapping so Zod and TypeScript output agree.
  if (enrichedField.isReadonly) {
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

  lines.push(`  ${propertyKey(propertyName)}: ${expression},`);
  return lines;
};

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
export const generateTableWritableZodSchema = (table: AirtableTable): string => {
  const schemaName = generateSchemaName(table.name);
  const typeBase = schemaName.replace(/Schema$/, '');
  const propertyNames = resolvePropertyNames(table, true);
  const lines: string[] = [];

  lines.push('/**');
  lines.push(` * Writable fields of "${sanitizeComment(table.name)}".`);
  lines.push(' * Computed fields are excluded, and nothing is defaulted: a write must carry');
  lines.push(' * exactly what the caller set.');
  lines.push(' */');
  lines.push(`export const ${typeBase}WritableSchema = z.object({`);

  table.fields
    .filter((field) => !enrichFieldMetadata(field).isReadonly)
    .forEach((field) => {
      const zodMapping = mapAirtableTypeToZod(field);
      const comment = describe(field.description, zodMapping.description);
      if (comment) {
        lines.push(`  /** ${comment} */`);
      }
      lines.push(
        `  ${propertyKey(propertyNames.get(field.id)!)}: ${zodMapping.expression}.optional(),`
      );
    });

  lines.push('});');
  lines.push('');
  lines.push('// Creation payload: writable fields only, all optional.');
  lines.push(`export const ${typeBase}CreationSchema = ${typeBase}WritableSchema;`);
  lines.push(`export type ${typeBase}Creation = z.infer<typeof ${typeBase}CreationSchema>;`);
  lines.push('');
  lines.push('// Update payload: the same fields, plus the record being updated.');
  lines.push(
    `export const ${typeBase}UpdateSchema = ${typeBase}WritableSchema.extend({ record_id: z.string().optional() });`
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
    lines.push("import { z } from 'zod';");
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

  // Only in flattened mode, provide creation/update schemas for write payloads.
  const helpersBlock = flatten
    ? '\n' + schema.tables.map(generateTableWritableZodSchema).join('\n\n')
    : '';

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
