# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-08-20

### 💥 Breaking Changes

- **Zod is now the default format** - The CLI now generates Zod schemas with inferred TypeScript types by default (was TypeScript-only before)
- **CLI options restructured** - Removed `--format` flag, added `--typescript-only` to generate TypeScript types without validation
- **Type inference updated** - Zod schemas now generate `z.infer<typeof Schema>` instead of `Readonly<z.infer<typeof Schema>>` for more flexible type usage
- **Native Airtable structure is default** - Non-flatten mode is now default, use `--flatten` for flattened structure

### ✨ Added

- **Perfect TypeScript/Zod alignment** - Both generators now use the exact same logic for readonly/optional field detection
- **Zod `.readonly()` support** - Computed fields are marked with `.readonly()` for runtime immutability validation
- **Restored v0.1.3 logic** - Brought back the correct optionality logic: `isOptional = isReadonly && !isAlwaysPresentComputed(field)`
- **New CLI options**:
  - `--typescript-only` / `--ts-only` - Generate only TypeScript types (no Zod validation)
  - `--native` / `--no-flatten` - Explicitly use native Airtable structure
- **Enhanced documentation** - README updated to reflect Zod-first approach

### 🐛 Fixed

- **Consistent readonly markers** - TypeScript interfaces now correctly show `readonly` for computed fields
- **Proper optionality** - Optional fields (`?`) only applied to computed fields that may be undefined
- **Test alignment** - All 106 tests now pass with updated expectations
- **CLI help accuracy** - Help text reflects actual default behavior

### 🔧 Technical Improvements

- **Unified field classification** - Single source of truth for determining field readonly/optional status
- **Better error handling** - More descriptive CLI error messages
- **Improved type safety** - Runtime validation aligns perfectly with compile-time types

## [0.2.2] - 2025-08-20

### Changed

- Align TypeScript generation with Zod semantics: no readonly or optional markers in TS interfaces; keep computed/readonly info in JSDoc. Zod output now adds `.optional()` to fields and uses `Readonly<z.infer<...>>` for type-level immutability.
- Zod flattened outputs now re-export `flattenRecord` for convenience.

### Added

- For Zod multi-file outputs, the index file exposes per-table readonly fields lists, creation/update helper schemas, and imports `z` to support `z.infer` typing.

### Fixed

- Multi-file Zod and TypeScript generation compile cleanly in `test-local` for all combinations (format, flatten, filters). Removed duplicate Zod imports and ensured correct utility wiring.

## [0.2.1] - 2025-08-20

### Fixed in 0.2.1

- Zod generation: ensure no duplicate `import { z } from 'zod'` when emitting single-file output; CLI now suppresses per-table imports in that mode.
- Naming consistency: the inferred TypeScript type for Zod is always `<Table>Record` and the Zod schema is `<Table>Schema` across single-file and multi-file outputs.
- Multi-file index: now imports referenced schema/type symbols and re-exports them, fixing missing-identifier compile errors.
- Utility types (Zod): map types as `{ schema: typeof <Table>Schema, type: <Table>Record }` to be valid TypeScript.
- TypeScript generator: removed `readonly` and optional (`?`) markers in generated interfaces to align with Zod semantics and avoid divergence. Computed/readonly status remains documented in JSDoc.

### Tests

- Added integration test to generate into `test-local/generated` and run `tsc --noEmit` to validate compilation for all option combinations: format (typescript/zod), flatten on/off, separate-files on/off, and table filters.
- Added unit tests for multi-file generation with `flatten: true` for both TypeScript and Zod.

## [0.2.0] - 2025-08-20

### Added in 0.2.0

- Zod: Generate Zod schemas alongside TypeScript types
  - New `--format zod` flag to output Zod schemas with inferred TS types
  - Includes helpers in runtime (`validateRecord`, `safeValidateRecord`, etc.)
- Multi-file output: Generate one file per table plus an index
  - Use `--separate-files` with `--output <dir>` to emit multiple files
  - Works for both `typescript` and `zod` formats
- CLI options:
  - `--format typescript|zod` to choose output format (default: typescript)
  - `--separate-files` to split output per table
  - Existing flags (`--flatten`, `--tables`, `--output`) supported across formats

### Changed in 0.2.0

- Generator: Refactored internals to support format selection and multi-file targets
- Docs: README expanded with Zod and multi-file examples, plus advanced usage

### Internal in 0.2.0

- Tests: Added unit tests for Zod generator and multi-file emission
- Runtime: Added Zod utilities for validation and schema ergonomics

## [0.1.2] - 2025-08-12

### Added in 0.1.2

- Runtime: `flattenRecords` now accepts both `Array<Record<FieldSet>>` and Airtable's `Records<FieldSet>` collection returned by `.select()` queries. This matches Airtable SDK defaults and eases direct piping of results.

### Changed in 0.1.2

- Types: `FlattenedRecord` index signature uses `unknown` (instead of `any`) for better type safety and to satisfy lint rules.

### Internal in 0.1.2

- Tests re-run; no public API breaks. Build remains unchanged.

## [0.1.3] - 2025-08-12

### Added in 0.1.3

- Runtime: `flattenRecord` and `flattenRecords` are now generic. You can specify the expected flattened type for a table, for example:
  `const users = flattenRecords<UsersRecord>(records);`
  This makes it ergonomic to align the runtime output with generated flattened interfaces.

### Note for 0.1.3

- No runtime behavior change; typing only.

## [0.1.1] - 2025-08-11

### Fixed in 0.1.1

- **Repository URL**: Fixed repository URL in package.json (was pointing to placeholder `username/airtable-types-gen`)
- **Version Display**: Updated CLI version display to correctly show 0.1.1
- **Types Generation**: Fixed major issues in TypeScript interface generation:
  - Fixed literal `\n` escape sequences appearing in generated output
  - Fixed string escaping issues in interface generation (proper quote escaping)
  - Improved property name conflict resolution logic
  - Better handling of readonly and optional field detection

### Added in 0.1.1

- **Dual Mode Support**: Added comprehensive support for both flattened and native Airtable record structures:
  - Flattened mode: Direct field access (`record.Name` instead of `record.fields.Name`)
  - Native mode: Standard Airtable structure with separate `fields` object and `createdTime`
- **Enhanced Interface Generation**:
  - Added proper JSDoc headers for all generated interfaces with table descriptions
  - Improved field documentation with clean description handling (removes line breaks)
  - Better property spacing and formatting in generated code
  - Smart property naming with advanced conflict resolution for edge cases
- **Advanced Utility Types**:
  - Separate utility types for flattened vs native modes
  - Enhanced CRUD types (`CreateRecord`, `UpdateRecord`, `ReadRecord`) with proper structure
  - Added `GetTableFields<T>` type for extracting field types from records
  - Flattened mode includes `FlattenedRecord` interface and re-exports `flattenRecord` function
  - Proper TypeScript generics for complete type safety
- **Test Coverage**: Added regression test to prevent literal escape sequence issues in output

### Changed in 0.1.1

- **Interface Structure**: Major refactoring of interface generation logic:
  - Flattened mode now uses `record_id` instead of `id` to avoid field name conflicts
  - Native mode preserves standard Airtable structure (`id`, `fields`, `createdTime`)
  - Improved property spacing and formatting in generated interfaces
  - Better separation between Fields interface and main Record interface in native mode
- **Build Configuration**: Updated .gitignore to exclude `.github/` directory from version control
- **Code Quality**: Significant improvements to type generation logic:
  - Complete rewrite of `generateTableInterface()` with mode-specific logic
  - Improved string handling and escaping throughout the generator
  - Enhanced conflict resolution for property names (especially `id` field variants)
  - Better separation of concerns between flattened and native utility type generation

### Technical Details (0.1.1)

- **Breaking Change in Flattened Mode**: Field access uses `record_id` instead of `id` for the Airtable record identifier
- **Improved Output Quality**: Generated TypeScript code now has proper formatting and no escape sequence artifacts
- **Enhanced Type Safety**: Better utility types that correctly reflect the actual data structures returned by Airtable API
- **Test Coverage**: Added specific test case to prevent regression of newline escape sequence issues

### Migration Notes (0.1.1)

If upgrading from 0.1.0 and using flattened mode, update your code to use `record_id` instead of `id` when accessing the Airtable record identifier in flattened records.

## [0.1.0] - 2025-08-11

### Added in 0.1.0

- Initial release of airtable-types-gen
- CLI tool inspired by Supabase type generation
- Smart TypeScript type generation from Airtable schemas
- Support for 32+ Airtable field types
- Computed field detection and readonly marking
- Property name conflict resolution
- Record flattening utilities (`flattenRecord`, `flattenRecords`)
- Optional flatten support via `--flatten` flag
- Table filtering via `--tables` option
- Comprehensive test suite with Vitest
- Utility types for CRUD operations
- Union types for single/multiple select fields
- JSDoc comments with field descriptions
- Support for stdout output (Supabase-style)

### Features in 0.1.0

- **CLI**: Simple command-line interface with Supabase-inspired syntax
- **Type Safety**: Strongly typed interfaces with proper optional handling
- **Smart Detection**: Automatic computed field detection and readonly marking
- **Utilities**: Record flattening for easier data manipulation
- **Flexibility**: Optional table filtering and output destinations
- **Documentation**: Comprehensive README with examples and integration guides
