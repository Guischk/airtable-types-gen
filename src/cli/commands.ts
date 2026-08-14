import * as fs from 'fs/promises';
import { generateMultipleFiles, writeMultipleFiles } from '../generator/multi-file.js';
import { fetchBaseSchema } from '../generator/schema.js';
import { generateAllTypes } from '../generator/types.js';
import { generateTableZodSchema, generateUtilityZodTypes } from '../generator/zod-generator.js';
import { CliOptions } from './options.js';

export const executeGenerate = async (options: CliOptions): Promise<void> => {
  // Validate required options
  const baseId = options.baseId || process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_PERSONAL_TOKEN;

  if (!baseId) {
    console.error(
      'Error: Base ID is required. Provide it via --base-id or AIRTABLE_BASE_ID environment variable.'
    );
    process.exit(1);
  }

  if (!token) {
    console.error(
      'Error: Airtable personal token is required. Set AIRTABLE_PERSONAL_TOKEN environment variable.'
    );
    process.exit(1);
  }

  try {
    // Determine format and defaults (Zod by default, TypeScript only if requested)
    const format = options.typescriptOnly ? 'typescript' : 'zod';
    // Non-flatten (native Airtable structure) by default
    const flatten = options.flatten || false;
    const separateFiles = options.separateFiles || false;

    // Validate separate files option
    if (separateFiles && !options.output) {
      console.error('Error: --separate-files requires --output directory to be specified.');
      process.exit(1);
    }

    // Fetch schema
    const schema = await fetchBaseSchema(baseId, token);
    let filteredSchema = schema;

    if (options.tables && options.tables.length > 0) {
      filteredSchema = {
        tables: schema.tables.filter((table) => options.tables!.includes(table.name)),
      };
      console.error(`[Generator] Filtering to ${options.tables.length} specified tables`);
    }

    if (separateFiles) {
      // Generate multiple files
      const multiFileResult = await generateMultipleFiles(filteredSchema, options.output!, {
        format,
        flatten,
      });

      await writeMultipleFiles(options.output!, multiFileResult.files);

      console.error(
        `✅ ${format === 'zod' ? 'Zod schemas' : 'TypeScript types'} generated successfully`
      );
      console.error(
        `📊 Generated ${Object.keys(multiFileResult.files).length} files for ${filteredSchema.tables.length} tables:`
      );
      filteredSchema.tables.forEach((table) => {
        console.error(`   - ${table.name} (${table.fields.length} fields)`);
      });
    } else {
      // Generate single file
      let content: string;

      if (format === 'zod') {
        // Generate Zod schemas
        const imports = "import { z } from 'zod';\n\n";
        const schemas = filteredSchema.tables
          .map((table) => generateTableZodSchema(table, flatten, { includeImport: false }))
          .join('\n\n');
        const utilityTypes = generateUtilityZodTypes(filteredSchema, { flatten });
        content = imports + schemas + utilityTypes;
      } else {
        // Generate TypeScript types (existing logic)
        content = generateAllTypes(filteredSchema, flatten);
      }

      // Output the result
      if (options.output) {
        // Write to file
        await fs.writeFile(options.output, content);
        console.error(
          `✅ ${format === 'zod' ? 'Zod schemas' : 'TypeScript types'} generated successfully and saved to ${options.output}`
        );
      } else {
        // Write to stdout (like supabase)
        process.stdout.write(content);
      }

      // Print summary to stderr
      console.error(
        `📊 Generated ${format === 'zod' ? 'schemas' : 'types'} for ${filteredSchema.tables.length} tables:`
      );
      filteredSchema.tables.forEach((table) => {
        console.error(`   - ${table.name} (${table.fields.length} fields)`);
      });
    }
  } catch (error) {
    console.error('Error generating types:', error);
    process.exit(1);
  }
};
