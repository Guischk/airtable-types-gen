# Known Issues

## Table names that differ only by case or punctuation

Airtable allows two tables to be named `Users` and `users`, or `My Table` and
`my-table`. Both reduce to the same TypeScript identifier (`UsersRecord`), so
the generated single-file output declares it twice and will not compile.

**Impact**: only bases that contain such a pair. Multi-file output is
unaffected — filenames are disambiguated (`my-table.ts`, `my-table-2.ts`) — but
the shared identifier in `index.ts` still collides.

**Workaround**: rename one of the tables, or use `--tables` to generate them
into separate outputs.

**Status**: open. Resolving it properly means suffixing the generated
identifiers, which would change type names for existing users, so it is
deferred to a release that can carry that break.

## Other Issues

None currently known. If you encounter issues, please report them at:

<https://github.com/Guischk/airtable-types-gen/issues>

## Resolved

- **Vitest CJS deprecation warning** — resolved in 0.5.0 by upgrading to
  Vitest 3. The `The CJS build of Vite's Node API is deprecated` message no
  longer appears.
