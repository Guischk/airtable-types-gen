import { AirtableBaseSchema, AirtableTable } from '../types.js';
import { bracketedKey, describe, literal, sanitizeComment } from './emit.js';
import {
  mapAirtableTypeToTSEnhanced,
  generateInterfaceName,
  resolvePropertyNames,
} from './schema.js';

/**
 * Emit the member lines for one interface's fields.
 *
 * The Zod emitter funnels both structures through a single `emitFieldEntry`;
 * this is its TypeScript counterpart. The flattened and native branches used to
 * carry byte-identical copies of this loop, differing only in the boolean
 * passed to `resolvePropertyNames` — so every change to per-field emission had
 * to be written twice. That is the shape that let the multi-file index drift
 * from the single-file output until 0.7.0 had to reconcile them.
 *
 * These interfaces describe the wire format, where every field is absent-able:
 * Airtable omits every empty cell. See `empty-value.ts` for what the Zod
 * emitter does with the same fact on the read path.
 */
const emitFieldEntries = (table: AirtableTable, flatten: boolean): string[] => {
  const lines: string[] = [];
  const propertyNames = resolvePropertyNames(table, flatten);

  table.fields.forEach((field, index) => {
    const propertyName = propertyNames.get(field.id)!;
    const typeMapping = mapAirtableTypeToTSEnhanced(field);
    const comment = describe(field.description, typeMapping.description);

    // Blank line between properties, but not before the first.
    if (index > 0) {
      lines.push('');
    }

    if (comment) {
      lines.push(`  /** ${comment} */`);
    }

    const readonlyModifier = typeMapping.readonly ? 'readonly ' : '';
    lines.push(`  ${readonlyModifier}${bracketedKey(propertyName)}?: ${typeMapping.type};`);
  });

  return lines;
};

export const generateTableInterface = (table: AirtableTable, flatten: boolean = false): string => {
  const interfaceName = generateInterfaceName(table.name);
  const interfaceLines: string[] = [];

  // Add interface header
  interfaceLines.push('/**');
  interfaceLines.push(` * Interface generated for table "${sanitizeComment(table.name)}"`);
  interfaceLines.push(
    ` * @description ${sanitizeComment(table.description || `Table ${table.name} from Airtable`)}`
  );
  interfaceLines.push(' */');

  if (flatten) {
    // Generate flattened interface (all fields at root level)
    interfaceLines.push(`export interface ${interfaceName} {`);
    interfaceLines.push('  /** Unique Airtable record ID */');
    interfaceLines.push('  record_id: string;');

    interfaceLines.push(...emitFieldEntries(table, true));

    interfaceLines.push('}');
  } else {
    // Generate standard Airtable interface (native structure)
    const fieldsInterfaceName = `${interfaceName}Fields`;

    // First, generate the Fields interface
    interfaceLines.push(`interface ${fieldsInterfaceName} {`);

    interfaceLines.push(...emitFieldEntries(table, false));

    interfaceLines.push('}');
    interfaceLines.push('');

    // Then generate the main record interface
    interfaceLines.push(`export interface ${interfaceName} {`);
    interfaceLines.push('  /** Unique Airtable record ID */');
    interfaceLines.push('  id: string;');
    interfaceLines.push('');
    interfaceLines.push('  /** Record fields */');
    interfaceLines.push(`  fields: ${fieldsInterfaceName};`);
    interfaceLines.push('');
    interfaceLines.push('  /** Record creation time */');
    interfaceLines.push('  createdTime: string;');
    interfaceLines.push('}');
  }

  return interfaceLines.join('\n');
};

/**
 * The utility types that accompany the interfaces — table-name union, record
 * mapping, create/update/read helpers.
 *
 * Exported because the multi-file index needs the same block. It used to carry
 * a hand-written subset instead, so a base generated with `--separate-files`
 * was missing `CreateRecord`, `UpdateRecord`, `ReadRecord` and
 * `AirtableSelectOptions` that the single-file run of the same base had.
 */
export const generateUtilityTypes = (
  schema: AirtableBaseSchema,
  flatten: boolean = false
): string => {
  const tableNames = schema.tables.map((table) => literal(table.name)).join(' | ');

  const tableTypesMapping = schema.tables
    .map((table) => `  ${literal(table.name)}: ${generateInterfaceName(table.name)};`)
    .join('\n');

  const tableNamesArray = schema.tables.map((table) => literal(table.name)).join(', ');

  if (flatten) {
    // Flattened mode utility types
    return `
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
 * Mapping of table names to their flattened record types
 */
export interface AirtableTableTypes {
${tableTypesMapping}
}

/**
 * Generic type to get the flattened record type for a table
 */
export type GetTableRecord<T extends AirtableTableName> = AirtableTableTypes[T];

/**
 * Type for creating new records (partial for optional fields)
 * Note: record_id should not be provided when creating
 */
export type CreateRecord<T extends AirtableTableName> = Partial<Omit<GetTableRecord<T>, 'record_id'>> & {
  record_id?: never;
};

/**
 * Type for updating existing records (partial for selective updates)
 */
export type UpdateRecord<T extends AirtableTableName> = Partial<Omit<GetTableRecord<T>, 'record_id'>> & {
  record_id: string;
};

/**
 * Type for reading flattened records (all fields)
 */
export type ReadRecord<T extends AirtableTableName> = GetTableRecord<T>;

/**
 * Flattened record type - removes Airtable FieldSet wrapper
 */
export interface FlattenedRecord {
  [key: string]: any;
}
/**
 * Flattens an Airtable record by extracting fields and adding the ID
 * This is a re-export from the runtime package for convenience
 */
export { flattenRecord } from 'airtable-types-gen/runtime';
`;
  } else {
    // Standard mode utility types (native Airtable structure)
    return `
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
 * Mapping of table names to their record types (native Airtable structure)
 */
export interface AirtableTableTypes {
${tableTypesMapping}
}

/**
 * Generic type to get the record type for a table
 */
export type GetTableRecord<T extends AirtableTableName> = AirtableTableTypes[T];

/**
 * Extract the fields type from a record type
 */
export type GetTableFields<T extends AirtableTableName> = GetTableRecord<T>['fields'];

/**
 * Airtable select options for queries
 */
export interface AirtableSelectOptions {
  view?: string;
  fields?: string[];
  filterByFormula?: string;
  maxRecords?: number;
  pageSize?: number;
  sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  cellFormat?: 'json' | 'string';
  timeZone?: string;
  userLocale?: string;
}

/**
 * Type for creating new records (only fields needed)
 */
export type CreateRecord<T extends AirtableTableName> = {
  fields: Partial<GetTableFields<T>>;
};

/**
 * Type for updating existing records (id + partial fields)
 */
export type UpdateRecord<T extends AirtableTableName> = {
  id: string;
  fields: Partial<GetTableFields<T>>;
};

/**
 * Type for reading records (full native Airtable structure)
 */
export type ReadRecord<T extends AirtableTableName> = GetTableRecord<T>;`;
  }
};

const generateImports = (): string => {
  const baseImports = `// Types generated automatically from Airtable schema
// ⚠️  Do not modify this file manually - it will be regenerated

`;

  return baseImports;
};

export const generateAllTypes = (schema: AirtableBaseSchema, flatten: boolean = false): string => {
  const imports = generateImports();

  const interfaces = schema.tables
    .map((table) => generateTableInterface(table, flatten))
    .join('\n\n');

  const utilityTypes = generateUtilityTypes(schema, flatten);

  return imports + interfaces + utilityTypes;
};
