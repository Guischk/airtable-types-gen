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

## `createUpdateSchema` behaves differently on Zod 3 and Zod 4

`createUpdateSchema` from `airtable-types-gen/runtime` applies `.partial()` to
the schema you pass it. Given a generated read schema — which carries
`.default('')`, `.default([])` and `.default(false)` — the two Zod majors
disagree about what happens to those defaults:

```js
UsersUpdateSchema.parse({ Name: 'Ada' });
// zod 3 → { Name: 'Ada' }
// zod 4 → { Name: 'Ada', Notes: '', IsActive: false, Projects: [] }
```

Sent as a PATCH, the Zod 4 result **blanks every cell the caller never
mentioned**. The same applies to `createCreationSchema`, less destructively.

**Impact**: only code that calls these helpers directly. Both are `@deprecated`
as of 0.6.0.

**Workaround**: use the generated `…UpdateSchema` and `…CreationSchema`, which
are built from a defaults-free shape and behave identically on both majors.

**Status**: open. The helpers cannot detect a `ZodDefault` without `_def`
introspection, which is Zod-3-only and was deliberately dropped in 0.5.0. They
will be removed in a later release rather than fixed.

## Other Issues

None currently known. If you encounter issues, please report them at:

<https://github.com/Guischk/airtable-types-gen/issues>

## Resolved

- **Vitest CJS deprecation warning** — resolved in 0.5.0 by upgrading to
  Vitest 3. The `The CJS build of Vite's Node API is deprecated` message no
  longer appears.
