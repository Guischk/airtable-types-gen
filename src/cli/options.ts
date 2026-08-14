import pkg from '../../package.json';

export class UnknownOptionError extends Error {
  constructor(public readonly option: string) {
    super(`Unknown option: ${option}`);
    this.name = 'UnknownOptionError';
  }
}

export interface CliOptions {
  baseId?: string;
  output?: string;
  flatten?: boolean;
  native?: boolean;
  tables?: string[];
  typescriptOnly?: boolean;
  separateFiles?: boolean;
  help?: boolean;
  version?: boolean;
}

export const parseArguments = (args: string[]): CliOptions => {
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--base-id':
      case '-b':
        if (nextArg && !nextArg.startsWith('-')) {
          options.baseId = nextArg;
          i++;
        }
        break;

      case '--output':
      case '-o':
        if (nextArg && !nextArg.startsWith('-')) {
          options.output = nextArg;
          i++;
        }
        break;

      case '--flatten':
      case '-f':
        options.flatten = true;
        break;

      case '--native':
      case '--no-flatten':
        // Native is the default, but passing it explicitly must still win over
        // an earlier --flatten instead of being silently discarded.
        options.native = true;
        options.flatten = false;
        break;

      case '--tables':
      case '-t':
        if (nextArg && !nextArg.startsWith('-')) {
          options.tables = nextArg.split(',').map((t) => t.trim());
          i++;
        }
        break;

      case '--typescript-only':
      case '--ts-only':
        options.typescriptOnly = true;
        break;

      case '--separate-files':
        options.separateFiles = true;
        break;

      case '--help':
      case '-h':
        options.help = true;
        break;

      case '--version':
      case '-v':
        options.version = true;
        break;

      default:
        // Unknown flags used to be dropped on the floor, which is how the
        // long-removed `--format zod` kept looking like it worked.
        if (arg.startsWith('-')) {
          throw new UnknownOptionError(arg);
        }
        break;
    }
  }

  return options;
};

export const printHelp = (): void => {
  const help = `
airtable-types-gen - Generate Zod schemas with TypeScript types from Airtable base schemas

USAGE:
  airtable-types-gen [OPTIONS]

EXAMPLES:
  # Generate Zod schemas with TypeScript inference (default)
  airtable-types-gen --base-id appXXXXXXXX > schemas.ts
  
  # Generate only TypeScript types (no validation)
  airtable-types-gen --base-id appXXXXXXXX --typescript-only --output types.ts
  
  # Generate separate files per table
  airtable-types-gen --base-id appXXXXXXXX --separate-files --output ./schemas/
  
  # Generate with flatten support (all fields at root level)
  airtable-types-gen --base-id appXXXXXXXX --flatten --output schemas.ts
  
  # Generate for specific tables only
  airtable-types-gen --base-id appXXXXXXXX --tables "Users,Projects" --output schemas.ts

OPTIONS:
  -b, --base-id <ID>       Airtable base ID (required)
  -o, --output <FILE>      Output file or directory (optional, defaults to stdout)
  -f, --flatten           Generate flattened structure (all fields at root level)
      --native            Generate native Airtable structure (default)
      --no-flatten        Alias for --native
  -t, --tables <NAMES>    Comma-separated list of table names to include
      --typescript-only    Generate only TypeScript types (default: Zod schemas + types)
      --ts-only           Alias for --typescript-only
      --separate-files     Generate separate files per table (requires --output directory)
  -h, --help              Show this help message
  -v, --version           Show version information

ENVIRONMENT VARIABLES:
  AIRTABLE_PERSONAL_TOKEN  Your Airtable personal access token (required)
  AIRTABLE_BASE_ID        Default base ID if --base-id is not provided

For more information, visit: https://github.com/Guischk/airtable-types-gen
`;

  console.log(help);
};

export const printVersion = (): void => {
  // Read version from package.json at runtime
  console.log(pkg.version);
};
