import { AirtableBaseSchema, AirtableTable } from '../types.js';
import { describe, literal, propertyKey, sanitizeComment } from './emit.js';
import { enrichFieldMetadata, isAlwaysPresentComputed } from './schema.js';
import {
  mapAirtableTypeToZod,
  generatePropertyName,
  generateSchemaName,
  generateTypeName,
} from './zod-schema.js';

/**
 * Emit the `  key: z.…,` entry (plus its JSDoc line) for one field.
 * Shared by the flattened and native shapes so the two cannot drift.
 */
const emitFieldEntry = (field: AirtableTable['fields'][number], propertyName: string): string[] => {
  const lines: string[] = [];
  const zodMapping = mapAirtableTypeToZod(field);
  const enrichedField = enrichFieldMetadata(field);
  const isOptional = enrichedField.isReadonly && !isAlwaysPresentComputed(field);

  const comment = describe(field.description, zodMapping.description);
  if (comment) {
    lines.push(`  /** ${comment} */`);
  }

  let expression = zodMapping.expression;
  // Applied here rather than in the mapping so Zod and TypeScript output agree.
  if (enrichedField.isReadonly) {
    expression += '.readonly()';
  }
  if (isOptional) {
    expression += '.optional()';
  }

  lines.push(`  ${propertyKey(propertyName)}: ${expression},`);
  return lines;
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

    const propertyNames = new Set<string>();
    propertyNames.add('record_id');

    table.fields.forEach((field) => {
      let propertyName = generatePropertyName(field.name);

      // Handle property name conflicts
      if (propertyNames.has(propertyName) || propertyName === 'id') {
        if (propertyName === 'id') {
          if (field.type === 'autoNumber') {
            propertyName = 'auto_id';
          } else if (field.type === 'number') {
            propertyName = 'field_id'; // Different from record_id
          } else {
            propertyName = `id_${field.type}`;
          }
        } else {
          propertyName = `${propertyName}_${field.type}`;
        }
      }
      propertyNames.add(propertyName);

      // Add empty line before property for readability
      lines.push('');
      lines.push(...emitFieldEntry(field, propertyName));
    });

    lines.push('});');
  } else {
    // Generate standard Airtable schema (native structure)
    const fieldsSchemaName = `${schemaName}Fields`;

    // First, generate the Fields schema
    lines.push(`const ${fieldsSchemaName} = z.object({`);

    const propertyNames = new Set<string>();

    table.fields.forEach((field, index) => {
      let propertyName = generatePropertyName(field.name);

      // Handle property name conflicts
      if (propertyNames.has(propertyName)) {
        if (field.type === 'autoNumber') {
          propertyName = 'auto_id';
        } else if (field.type === 'number' && propertyName === 'id') {
          propertyName = 'record_id';
        } else {
          propertyName = `${propertyName}_${field.type}`;
        }
      }
      propertyNames.add(propertyName);

      // Add empty line before property if we have previous fields
      if (index > 0) {
        lines.push('');
      }
      lines.push(...emitFieldEntry(field, propertyName));
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

  // Only in flattened mode, provide creation/update helpers based on flat schema shape
  const helpersBlock = flatten
    ? '\n' +
      schema.tables
        .map((table) => {
          const schemaName = generateSchemaName(table.name);
          const typeBase = generateSchemaName(table.name).replace(/Schema$/, '');
          return `// Creation schema excludes readonly fields and record_id\nexport const ${typeBase}CreationSchema = createCreationSchema(${schemaName}, [...${typeBase}ReadonlyFields, 'record_id']);\nexport type ${typeBase}Creation = z.infer<typeof ${typeBase}CreationSchema>;\n\n// Update schema allows partial updates\nexport const ${typeBase}UpdateSchema = createUpdateSchema(${schemaName});\nexport type ${typeBase}Update = z.infer<typeof ${typeBase}UpdateSchema>;`;
        })
        .join('\n\n')
    : '';

  const base = `
${flatten ? "import { createUpdateSchema, createCreationSchema } from 'airtable-types-gen/runtime';\n" : ''}
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
