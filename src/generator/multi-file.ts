import { promises as fs } from 'fs';
import path from 'path';
import { AirtableBaseSchema, AirtableTable } from '../types.js';
import { literal } from './emit.js';
import { generateInterfaceName } from './schema.js';
import { generateTableZodSchema, generateUtilityZodTypes } from './zod-generator.js';
import { generateSchemaName, generateTypeName } from './zod-schema.js';
import { generateTableInterface } from './types.js';

export interface MultiFileResult {
  files: { [fileName: string]: string };
  indexContent: string;
}

export const generateTableFileName = (tableName: string): string => {
  const fileName = tableName
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, '') // Remove special characters except spaces, hyphens, underscores
    .replace(/[\s-_]+/g, '-') // Replace spaces, hyphens, underscores with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // A name made only of symbols or emoji would otherwise yield "" and emit a
  // file literally called ".ts" plus an `import './.js'` nobody can resolve.
  return fileName || 'table';
};

/**
 * Filenames for every table, disambiguated across the whole base.
 *
 * `generateTableFileName` is deliberately pure, so it cannot see that "My Table"
 * and "my-table" both reduce to `my-table` — one file would silently overwrite
 * the other. Resolving that needs a view of every table at once, which is what
 * this does: first occurrence keeps the plain name, later ones get -2, -3, ...
 */
export const buildTableFileNames = (tables: AirtableTable[]): Map<string, string> => {
  const used = new Map<string, number>();
  const result = new Map<string, string>();

  for (const table of tables) {
    const base = generateTableFileName(table.name);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    result.set(table.name, seen === 0 ? base : `${base}-${seen + 1}`);
  }

  return result;
};

export const generateSingleTableFile = (
  table: AirtableTable,
  options: { format: 'typescript' | 'zod'; flatten?: boolean }
): string => {
  const { format, flatten = false } = options;

  if (format === 'zod') {
    // Include import inside each file
    return generateTableZodSchema(table, flatten, { includeImport: true });
  } else {
    // Use existing TypeScript generator but need to extract the single table logic
    return generateTableInterface(table, flatten);
  }
};

export const generateIndexFile = (
  schema: AirtableBaseSchema,
  options: { format: 'typescript' | 'zod'; flatten?: boolean }
): string => {
  const { format } = options;
  const lines: string[] = [];
  const fileNames = buildTableFileNames(schema.tables);

  // Add header comment
  lines.push('// Auto-generated index file - do not modify manually');
  lines.push('// Re-exports all table schemas/types');
  lines.push('');

  // First, add local imports so that referenced symbols exist in this module scope
  schema.tables.forEach((table) => {
    const fileName = fileNames.get(table.name)!;
    if (format === 'zod') {
      const schemaName = generateSchemaName(table.name);
      const typeName = generateTypeName(table.name);
      lines.push(`import { ${schemaName}, type ${typeName} } from './${fileName}.js';`);
    } else {
      lines.push(`import type { ${generateInterfaceName(table.name)} } from './${fileName}.js';`);
    }
  });

  lines.push('');

  // Generate exports for each table (public surface)
  schema.tables.forEach((table) => {
    const fileName = fileNames.get(table.name)!;

    if (format === 'zod') {
      const schemaName = generateSchemaName(table.name);
      const typeName = generateTypeName(table.name);
      lines.push(`export { ${schemaName}, type ${typeName} } from './${fileName}.js';`);
    } else {
      lines.push(`export type { ${generateInterfaceName(table.name)} } from './${fileName}.js';`);
    }
  });

  lines.push('');

  // Add utility types
  if (format === 'zod') {
    lines.push('// Utility types for Zod schemas');
    // Import z for z.infer in utility types
    lines.push(`import { z } from 'zod';`);
    const utilityTypes = generateUtilityZodTypes(schema, { flatten: options.flatten });
    lines.push(utilityTypes);
  } else {
    // Add TypeScript utility types (adapted from existing generator)
    lines.push('// Utility types');
    const tableNames = schema.tables.map((table) => literal(table.name)).join(' | ');

    const tableNamesArray = schema.tables.map((table) => literal(table.name)).join(', ');

    const tableTypesMapping = schema.tables
      .map((table) => `  ${literal(table.name)}: ${generateInterfaceName(table.name)};`)
      .join('\n');

    lines.push(`export type AirtableTableName = ${tableNames};`);
    lines.push('');
    lines.push('/** Array of all available table names (runtime constant) */');
    lines.push(`export const AIRTABLE_TABLE_NAMES = [${tableNamesArray}] as const;`);
    lines.push('');
    lines.push('export interface AirtableTableTypes {');
    lines.push(tableTypesMapping);
    lines.push('}');
    lines.push('');
    lines.push('export type GetTableRecord<T extends AirtableTableName> = AirtableTableTypes[T];');
    lines.push('');
    lines.push('export type GetTableFields<T extends AirtableTableName> =');
    lines.push('  GetTableRecord<T> extends { fields: infer F } ? F : GetTableRecord<T>;');
  }

  return lines.join('\n');
};

export const generateMultipleFiles = async (
  schema: AirtableBaseSchema,
  outputDir: string,
  options: { format: 'typescript' | 'zod'; flatten?: boolean }
): Promise<MultiFileResult> => {
  const files: { [fileName: string]: string } = {};

  // Generate individual table files
  const fileNames = buildTableFileNames(schema.tables);
  for (const table of schema.tables) {
    const fileName = `${fileNames.get(table.name)!}.ts`;
    files[fileName] = generateSingleTableFile(table, options);
  }

  // Generate index file
  const indexContent = generateIndexFile(schema, options);
  files['index.ts'] = indexContent;

  return {
    files,
    indexContent,
  };
};

export const writeMultipleFiles = async (
  outputDir: string,
  files: { [fileName: string]: string }
): Promise<void> => {
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Write all files
  const writePromises = Object.entries(files).map(async ([fileName, content]) => {
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(filePath, content, 'utf8');
    console.error(`[MultiFile] Generated: ${filePath}`);
  });

  await Promise.all(writePromises);
  console.error(`[MultiFile] Generated ${Object.keys(files).length} files in ${outputDir}`);
};
