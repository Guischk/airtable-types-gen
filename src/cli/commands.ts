import * as fs from 'fs/promises';
import { generateFromSchema } from '../generator/generate.js';
import { writeMultipleFiles } from '../generator/multi-file.js';
import { fetchBaseSchema } from '../generator/schema.js';
import { OutputFormat } from '../types.js';
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
    const format: OutputFormat = options.typescriptOnly ? 'typescript' : 'zod';
    // Non-flatten (native Airtable structure) by default
    const flatten = options.flatten || false;
    const separateFiles = options.separateFiles || false;

    // Validate separate files option
    if (separateFiles && !options.output) {
      console.error('Error: --separate-files requires --output directory to be specified.');
      process.exit(1);
    }

    const baseSchema = await fetchBaseSchema(baseId, token);

    const result = generateFromSchema({
      schema: baseSchema,
      format,
      flatten,
      tables: options.tables,
      layout: separateFiles ? 'separate' : 'single',
    });

    // Reports the tables that actually matched, not the names that were asked
    // for — `--tables Typo` used to log a filter that kept nothing.
    if (result.schema.tables.length < baseSchema.tables.length) {
      console.error(
        `[Generator] Filtered to ${result.schema.tables.length} of ${baseSchema.tables.length} tables`
      );
    }

    const wording =
      format === 'zod'
        ? { label: 'Zod schemas', noun: 'schemas' }
        : { label: 'TypeScript types', noun: 'types' };

    if (result.layout === 'separate') {
      await writeMultipleFiles(options.output!, result.files);

      console.error(`✅ ${wording.label} generated successfully`);
      console.error(
        `📊 Generated ${Object.keys(result.files).length} files for ${result.schema.tables.length} tables:`
      );
    } else {
      if (options.output) {
        await fs.writeFile(options.output, result.content);
        console.error(`✅ ${wording.label} generated successfully and saved to ${options.output}`);
      } else {
        // stdout carries the generated module when used as
        // `airtable-types-gen > schemas.ts`; every other line goes to stderr.
        process.stdout.write(result.content);
      }

      console.error(`📊 Generated ${wording.noun} for ${result.schema.tables.length} tables:`);
    }

    result.schema.tables.forEach((table) => {
      console.error(`   - ${table.name} (${table.fields.length} fields)`);
    });
  } catch (error) {
    console.error('Error generating types:', error);
    process.exit(1);
  }
};
