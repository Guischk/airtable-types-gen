# airtable-types-gen

Generate Zod schemas with TypeScript types from Airtable base schemas.

Inspired by Supabase's type generation, this tool provides a simple CLI to generate Zod validation schemas with inferred TypeScript types from your Airtable bases, featuring smart detection of computed fields, readonly validation, and runtime type safety.

## Features

- 🚀 **Simple CLI** - Inspired by `supabase gen types` with Zod-first approach
- 🎯 **Smart Type Detection** - 33 Airtable field types mapped to TypeScript and Zod
- 🔒 **Readonly Validation** - Computed fields marked `.readonly()` in Zod for runtime safety
- 🏷️ **Strict Types** - Union types for select fields, perfect TS/Zod alignment
- 🛠️ **Runtime Utilities** - Record flattening and CRUD helper functions
- 📦 **Multi-file Output** - Generate one file per table with an index
- ✅ **Zod by Default** - Runtime validation with inferred TypeScript types
- ✨ **Conflict Resolution** - Intelligent property naming for edge cases
- 🧪 **Well Tested** - Comprehensive test suite (193 tests) with Vitest
- 🔀 **Zod 3 and Zod 4** - Generated schemas work on either major

## Installation

```bash
pnpm add -g airtable-types-gen

# Or use without installing
pnpm dlx airtable-types-gen --help
```

Requires Node.js 22.12 or newer.

`zod` is an optional peer dependency covering both majors (`^3.25 || ^4`).
Install it alongside if you use the default Zod output; it is not needed for
`--typescript-only`:

```bash
pnpm add zod
```

## Quick Start

### 1. Set up your environment

#### Option A: Using .env file (recommended)

```bash
# Copy the example file
cp .env.example .env

# Edit .env and fill in your values:
# AIRTABLE_PERSONAL_TOKEN=your_personal_access_token
# AIRTABLE_BASE_ID=appXXXXXXXX
```

#### Option B: Environment variables

```bash
export AIRTABLE_PERSONAL_TOKEN="your_personal_access_token"
export AIRTABLE_BASE_ID="appXXXXXXXX"
```

Get your personal access token from [Airtable Developer Hub](https://airtable.com/developers/web/api/introduction).

### 2. Generate schemas

```bash
# Generate Zod schemas with TypeScript types (default)
pnpm dlx airtable-types-gen > schemas.ts

# Generate to a specific file
pnpm dlx airtable-types-gen --output src/types/airtable.ts

# Generate only TypeScript types (no validation)
pnpm dlx airtable-types-gen --typescript-only --output types.ts

# Generate with flatten support (all fields at root level)
pnpm dlx airtable-types-gen --flatten --output schemas.ts

# Generate schemas for specific tables only
pnpm dlx airtable-types-gen --tables "Users,Projects" --output schemas.ts

# Generate separate files per table
pnpm dlx airtable-types-gen --separate-files --output ./schemas/

# You can still override with --base-id if needed
pnpm dlx airtable-types-gen --base-id "appXXXXXXXX" --output schemas.ts
```

## CLI Options

```bash
airtable-types-gen [OPTIONS]

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
  -h, --help              Show help message
  -v, --version           Show version information

Unknown options are rejected with a non-zero exit code rather than ignored.

ENVIRONMENT VARIABLES:
  AIRTABLE_PERSONAL_TOKEN  Your Airtable personal access token (required)
  AIRTABLE_BASE_ID        Default base ID if --base-id is not provided
```

## Generated Types (TypeScript)

Two shapes are available. **Native** (the default) mirrors Airtable's own record
structure; **flattened** (`--flatten`) lifts every field to the root.

### Native shape (default)

```typescript
/**
 * Interface generated for table "Users"
 * @description Users table from Airtable
 */
interface UsersRecordFields {
  Name?: string;
  Email?: string;
  Age?: number;
  Active?: boolean;
  Role?: "Admin" | "User" | "Guest";
  /** 🔒 Computed by Airtable - readonly ISO date string */
  readonly Created?: string;
  /** 🔒 Computed by Airtable - auto-incrementing number */
  readonly ["Auto ID"]?: number;
}

export interface UsersRecord {
  /** Unique Airtable record ID */
  id: string;
  /** Record fields */
  fields: UsersRecordFields;
  /** Record creation time */
  createdTime: string;
}
```

### Flattened shape (`--flatten`)

```typescript
export interface UsersRecord {
  /** Unique Airtable record ID */
  record_id: string;
  Name?: string;
  Email?: string;
  readonly Created?: string;
}
```

Note the record ID is `id` in native mode and `record_id` in flattened mode.

**Every field is optional.** Airtable omits empty cells from its responses
entirely, so the wire format guarantees no field at all — and these interfaces
describe the wire format. The Zod schemas describe what comes back out of
`.parse()`, where some of those fields are restored — see
[Zod specifics](#zod-specifics).

### Utility Types

```typescript
// Table name union
export type AirtableTableName = "Users" | "Projects";

// Runtime constant, iterable at runtime
export const AIRTABLE_TABLE_NAMES = ["Users", "Projects"] as const;

// Get record type for a table
export type GetTableRecord<T extends AirtableTableName> = AirtableTableTypes[T];
export type GetTableFields<T extends AirtableTableName> = GetTableRecord<T>["fields"];

// CRUD operation types — native mode
export type CreateRecord<T extends AirtableTableName> = {
  fields: Partial<GetTableFields<T>>;
};
export type UpdateRecord<T extends AirtableTableName> = {
  id: string;
  fields: Partial<GetTableFields<T>>;
};
export type ReadRecord<T extends AirtableTableName> = GetTableRecord<T>;
```

In flattened mode `CreateRecord`/`UpdateRecord` operate on the flat shape and
key off `record_id` instead of a nested `fields` object.

## Library Usage

### Import Generated Types

```typescript
import type { UsersRecord, ProjectsRecord, CreateRecord, UpdateRecord } from './types';

// Type-safe record creation (native shape: fields live under `fields`)
const newUser: CreateRecord<'Users'> = {
  fields: {
    Name: 'John Doe',
    Email: 'john@example.com',
    Active: true,
    Role: 'User',
    // Computed/readonly fields such as 'Created' and 'Auto ID' are not writable
  },
};
```

### Record Flattening

The package includes a powerful record flattening utility that removes Airtable's `FieldSet` wrapper:

```typescript
import { flattenRecord, flattenRecords } from 'airtable-types-gen';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: 'your-api-key' }).base('appXXXXXXXX');

// Flatten a single record
const record = await base('Users').find('recXXXXXXXX');
const flattened = flattenRecord(record);
console.log(flattened.Name); // Direct access, no .fields wrapper

// Flatten multiple records
// Works with array of Record<FieldSet> or Airtable's Records<FieldSet> collection
const records = await base('Users').select().all();
const flattened = flattenRecords(records);
// Or directly with the collection (e.g., from .select().firstPage())
const page = await base('Users').select({ pageSize: 50 }).firstPage();
const flattenedPage = flattenRecords(page);
flattened.forEach((user) => {
  console.log(user.Name, user.Email); // Direct access to fields
});

// Type-safe flattened results (v0.1.3+):
// If you generated types with --flatten, you can type the output as your table's flattened interface
import type { UsersRecord } from './types';

const typedUsers: UsersRecord[] = flattenRecords<UsersRecord>(records);
const oneUser: UsersRecord = flattenRecord<UsersRecord>(record);

// Note: Ensure your generated types were created with --flatten for the
// table interfaces (e.g., UsersRecord) to match the flattened shape.
```

### Validating SDK records (`toRawRecord`)

Generated schemas describe the shape the **REST API** returns —
`{ id, createdTime, fields }`. The `airtable` SDK does not hand that back: its
`Record` exposes `id` and `fields`, but keeps `createdTime` on the undocumented
`_rawJson`. Validating an SDK record directly therefore always fails on
`createdTime`.

`toRawRecord` rebuilds the wire shape so you never have to reach into `_rawJson`
yourself:

```typescript
import { toRawRecord, toRawRecords } from 'airtable-types-gen/runtime';
import { UsersSchema } from './schemas';

const record = await base('Users').find('recXXXXXXXX');
const user = UsersSchema.parse(toRawRecord(record));

const records = await base('Users').select().all();
const users = toRawRecords(records).map((raw) => UsersSchema.parse(raw));
```

Not needed in flattened mode: the flattened schema is keyed on `record_id` plus
fields and carries no creation time, so `flattenRecord` already produces a
matching object.

### Advanced Usage

```typescript
import { generateTypes } from 'airtable-types-gen';

// Programmatic type generation (advanced)
const result = await generateTypes({
  baseId: 'appXXXXXXXX',
  token: 'your-token',
  flatten: true,
  tables: ['Users', 'Projects'],
});

console.log(result.content); // Generated TypeScript code
console.log(result.schema); // Parsed Airtable schema
```

## Zod Schemas

Zod is the default output; use `--typescript-only` to opt out.

```bash
# Single file with Zod schemas
pnpm dlx airtable-types-gen --base-id appXXXXXXXX --output zod-schemas.ts

# Flattened Zod schemas
pnpm dlx airtable-types-gen --base-id appXXXXXXXX --flatten --output zod-schemas-flat.ts

# One file per table (+ index.ts) with Zod
pnpm dlx airtable-types-gen --base-id appXXXXXXXX --separate-files --output ./schemas
```

### Zod 3 and Zod 4

Generated schemas are emitted as source text that is valid on both majors, so
whichever one your project already uses will work. The peer range is
`^3.25 || ^4`, and every emitted expression is exercised against both in CI.

Example usage:

```ts
import { UsersSchema, type UsersRecord } from './schemas/users';
import { validateRecord, safeValidateRecord } from 'airtable-types-gen/runtime';

// Validate at runtime and get typed data
const user: UsersRecord = validateRecord(UsersSchema, {
  record_id: 'rec123',
  Name: 'Jane',
  Email: 'jane@example.com'
});

// Or safely
const result = safeValidateRecord(UsersSchema, someData);
if (result.success) {
  // result.data is typed as UsersRecord
} else {
  console.error(result.error);
}
```

### Zod specifics

#### Sparse payloads

Airtable never sends an empty cell. It drops the key, and
[documents](https://airtable.com/developers/web/api/list-records) which values
count as empty:

> Returned records do not include any fields with 'empty' values, e.g. `""`,
> `[]`, or `false`.

Note `false`: an unchecked box is not sent as `false`, it is not sent at all. So
**no field is guaranteed to arrive**, and every generated field schema accepts
its absence.

For the types in that quote the omission is not missing information — it *is*
the value, compressed. Those fields get `.default(...)`, so parsing restores what
Airtable erased and the parsed field is not optional:

| Emitted             | Field types                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `.default('')`      | `singleLineText` `multilineText` `richText` `email` `url` `phoneNumber`                                  |
| `.default([])`      | `multipleSelects` `multipleAttachments` `multipleRecordLinks` `multipleCollaborators` `lookup` `multipleLookupValues` |
| `.default(false)`   | `checkbox`                                                                                               |
| `.optional()`       | everything else                                                                                          |

Everything else stays optional because the omission carries no known value: `0`
is not in Airtable's list, so an absent number is genuinely unknown rather than
zero, an absent date is not the epoch, and an absent single-select is not the
first choice.

```typescript
const user = UsersSchema.parse({
  id: "recABC",
  createdTime: "2026-08-15T10:00:00.000Z",
  fields: { Name: "Ada" }, // everything else is empty, so Airtable omitted it
});

user.fields.Name;     // string   — no guard needed
user.fields.Notes;    // string   — restored to ''
user.fields.Active;   // boolean  — restored to false
user.fields.Projects; // string[] — restored to []
user.fields.Age;      // number | undefined — an absent number is not 0
```

`email`, `url` and `phoneNumber` also accept `''` explicitly (`.or(z.literal(''))`),
since their own validation would otherwise reject the value the default hands
back.

#### Writing records

The creation and update schemas are built from a separate, defaults-free shape:

```typescript
UsersUpdateSchema.parse({ Name: "Ada" }); // → { Name: 'Ada' }, nothing else
```

Do **not** rebuild them with `createUpdateSchema`/`createCreationSchema` from
`airtable-types-gen/runtime` (both deprecated). Those apply `.partial()` to the
read schema, which keeps defaults on Zod 4 and drops them on Zod 3 — so the same
update payload blanks untouched cells on one major only.

#### Other notes

- Computed fields are marked `.readonly()`.
- The inferred type exported next to each schema is `z.infer<typeof ...>`.
- In flattened Zod output (`--flatten`), the generated file also re-exports
  `flattenRecord`, and adds per-table `…CreationSchema` / `…UpdateSchema`
  helpers. These helpers are flattened-mode only.
- Per-table `…ReadonlyFields` arrays are emitted in both modes.
- Every generated file exposes an `AIRTABLE_SCHEMAS` registry and a
  `validateTableRecord(tableName, data)` helper.

Example (flattened Zod + multi-file):

```ts
import { UsersSchema, type UsersRecord, UsersReadonlyFields, UsersCreationSchema, UsersUpdateSchema } from './schemas';
// You can also import flattenRecord directly from the generated index in flattened Zod mode
import { flattenRecord } from './schemas';

// Runtime validation with typed result
const user: UsersRecord = UsersSchema.parse({ record_id: 'rec1', Name: 'Ada' });

// Readonly fields list
console.log(UsersReadonlyFields);

// Helper schemas for creation/update payloads
UsersCreationSchema.parse({ Name: 'Ada' }); // readonly fields + record_id excluded
UsersUpdateSchema.parse({ Name: 'Ada' });   // partial update
```

## Multi-file generation (new in v0.2)

Generate one file per table plus an index re-export:

```bash
# Zod schemas per table (default)
pnpm dlx airtable-types-gen --base-id appXXXXXXXX --separate-files --output ./schemas

# TypeScript types per table
pnpm dlx airtable-types-gen --base-id appXXXXXXXX --typescript-only --separate-files --output ./types
```

This produces files like:

```text
./schemas/
  users.ts
  projects.ts
  index.ts
```

## Integration Examples

### With Build Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "types:generate": "airtable-types-gen --base-id $AIRTABLE_BASE_ID --output src/types/airtable.ts",
    "types:watch": "chokidar 'airtable-schema.json' -c 'pnpm run types:generate'",
    "build": "pnpm run types:generate && tsc"
  }
}
```

### With GitHub Actions

```yaml
name: Generate Types
on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  generate-types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'

      - run: pnpm dlx airtable-types-gen --base-id ${{ secrets.AIRTABLE_BASE_ID }} --output src/types/airtable.ts
        env:
          AIRTABLE_PERSONAL_TOKEN: ${{ secrets.AIRTABLE_PERSONAL_TOKEN }}

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v7
        with:
          title: 'Update Airtable types'
          body: 'Auto-generated type updates from Airtable schema changes'
```

## Smart Features

### Computed Field Detection

Automatically detects and marks readonly fields:

- `formula`, `rollup`, `count`, `lookup`
- `createdTime`, `lastModifiedTime`
- `createdBy`, `lastModifiedBy`
- `autoNumber`

### Property Name Conflict Resolution

Handles edge cases gracefully:

- Reserved words and special characters
- Duplicate property names
- Conflicts with the `id` field

### Type Safety

- Union types for single/multiple select fields
- Optional properties throughout, matching Airtable's sparse payloads
- Proper typing for attachments, linked records, and user fields

## Development

This project uses **pnpm** exclusively. Other lockfiles are gitignored.

```bash
# Clone and install
git clone https://github.com/Guischk/airtable-types-gen
cd airtable-types-gen
pnpm install

# Build (runs lint + format first)
pnpm run build

# Test
pnpm test
pnpm run test:watch
pnpm run test:ui

# Lint
pnpm run lint
pnpm run format
```

### Supply-chain posture

- `pnpm-lock.yaml` is committed so the dependency graph is reviewable.
- Dependency lifecycle scripts are blocked by default; the allowlist lives in
  `pnpm-workspace.yaml` and currently holds one reviewed entry (`esbuild`,
  dev-only, required by vitest).
- `.npmrc` sets `minimum-release-age=4320`, so no version published within the
  last three days can enter the lockfile.

## License

MIT

## Contributing

Contributions welcome! Please submit PRs against the `master` branch.

## Troubleshooting

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for known issues and workarounds.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

---

Made with ❤️ for the Airtable + TypeScript community
