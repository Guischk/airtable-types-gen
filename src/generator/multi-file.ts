import { promises as fs } from 'fs';
import path from 'path';
import { AirtableBaseSchema, AirtableTable, EmitOptions } from '../types.js';
import { generateInterfaceName } from './schema.js';
import { generateTableZodSchema, generateUtilityZodTypes, ZOD_IMPORT } from './zod-generator.js';
import { generateSchemaName, generateTypeName } from './zod-schema.js';
import { generateTableInterface, generateUtilityTypes } from './types.js';

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

export const generateSingleTableFile = (table: AirtableTable, options: EmitOptions): string => {
  const { format, flatten = false } = options;

  if (format === 'zod') {
    // Include import inside each file
    return generateTableZodSchema(table, flatten, { includeImport: true });
  } else {
    // Use existing TypeScript generator but need to extract the single table logic
    return generateTableInterface(table, flatten);
  }
};

export const generateIndexFile = (schema: AirtableBaseSchema, options: EmitOptions): string => {
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
    lines.push(ZOD_IMPORT);
    const utilityTypes = generateUtilityZodTypes(schema, { flatten: options.flatten });
    lines.push(utilityTypes);
  } else {
    // The same block the single-file run emits, rather than a subset of it.
    lines.push('// Utility types');
    lines.push(generateUtilityTypes(schema, options.flatten));
  }

  return lines.join('\n');
};

/**
 * One module per table plus an `index.ts`, keyed by filename.
 *
 * Pure: it decides what the files contain, not where they land. Writing them is
 * `writeMultipleFiles`, and choosing this layout at all is `generateFromSchema`.
 */
export const generateSeparateFiles = (
  schema: AirtableBaseSchema,
  options: EmitOptions
): Record<string, string> => {
  const files: Record<string, string> = {};

  const fileNames = buildTableFileNames(schema.tables);
  for (const table of schema.tables) {
    files[`${fileNames.get(table.name)!}.ts`] = generateSingleTableFile(table, options);
  }

  files['index.ts'] = generateIndexFile(schema, options);

  return files;
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
