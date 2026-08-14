#!/usr/bin/env node

// Load .env file if it exists (for convenience).
// `quiet` suppresses dotenv 17's banner, which it writes to stdout — that would
// land inside the generated module whenever the CLI is used as
// `airtable-types-gen > schemas.ts`.
import { config } from 'dotenv';
config({ path: '.env', quiet: true });

import { parseArguments, printHelp, printVersion, UnknownOptionError } from './options.js';
import { executeGenerate } from './commands.js';

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);

  let options;
  try {
    options = parseArguments(args);
  } catch (error) {
    if (error instanceof UnknownOptionError) {
      console.error(`Error: ${error.message}`);
      console.error('Run `airtable-types-gen --help` to see the available options.');
      process.exit(1);
    }
    throw error;
  }

  // Handle help and version flags
  if (options.help) {
    printHelp();
    return;
  }

  if (options.version) {
    printVersion();
    return;
  }

  // Execute the main command (generate types)
  await executeGenerate(options);
};

// Run the CLI
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
