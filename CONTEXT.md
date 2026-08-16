# Context

Vocabulary this project relies on. Kept deliberately short: terms land here once
a decision has actually turned on them, not in anticipation.

## Wire format

The JSON `https://api.airtable.com/v0/{baseId}/{tableId}` returns, and the shape
generated schemas describe: `{ id, createdTime, fields }`.

Distinct from **the SDK shape** — what the `airtable` npm package's `Record`
exposes. The SDK carries `id` and `fields` but keeps `createdTime` on the
undocumented `_rawJson`, so the two are not interchangeable. `toRawRecord`
converts SDK shape → wire format.

Do not call the wire format "raw JSON" in prose; `_rawJson` is the SDK's own
name for its private copy, and reusing it blurs the distinction the adapter
exists to draw.

## Empty value

Airtable's term, not ours. The API omits any cell holding an empty value, and
[documents](https://airtable.com/developers/web/api/list-records) which values
qualify: `""`, `[]`, `false`.

The word carries more weight than it looks like. `false` is an empty value, so an
unchecked box is absent rather than `false`. `0` is *not* an empty value, so an
absent number is unknown rather than zero. Every rule in
`src/generator/empty-value.ts` is that sentence applied.

## Absent-able field

A field that may not appear in a payload. Since Airtable omits every empty cell,
**every** field is absent-able — the term is worth having only because the
generator used to assume otherwise, which is the defect in
[#2](https://github.com/Guischk/airtable-types-gen/issues/2).

Not a synonym for **computed** (`formula`, `rollup`, `createdTime`, …), which is
about writability and drives `.readonly()`. The two were conflated: optionality
used to be gated on readonly-ness, so writable fields were wrongly required.

## Read path / write path

The **read path** parses what Airtable sent. It restores empty values, so parsed
text is `string` rather than `string | undefined`.

The **write path** builds what gets sent back (`…WritableSchema`,
`…CreationSchema`, `…UpdateSchema`). It must carry *only* what the caller set: a
default here would blank cells the caller never mentioned.

Consequently the two never share a schema object. Deriving one from the other —
`.partial()`, `.omit()` — carries read-path defaults onto the write path, which
is a data-loss bug, not a style preference. See `KNOWN_ISSUES.md`.

## Emitter

A function producing generated *source text* rather than a runtime value. There
are two, and they describe different stages of one pipeline:

- the **TypeScript emitter** (`src/generator/types.ts`) describes data as it
  arrives — every field optional;
- the **Zod emitter** (`src/generator/zod-generator.ts`) describes data as it
  leaves `.parse()` — empty values restored.

They are allowed to differ on that output, but must agree on what Airtable can
omit. `tests/unit/emitter-alignment.test.ts` holds them to it.

The generator never builds a Zod schema object and inspects it: `_def`
introspection is Zod-3-only, and this package supports both majors.

## Format / layout / structure

Three independent axes of the generated output. Every combination is
compile-tested, so none of them may be described in terms of another.

- **Format** — what the source is written in: `zod` or `typescript`.
- **Layout** — how it is split: `single` (one module for the whole base) or
  `separate` (one module per table plus an `index.ts`, what `--separate-files`
  asks for).
- **Structure** — how a record is shaped: `native` (fields nested under
  `fields`, next to `id` and `createdTime`) or `flattened` (fields at the root
  next to `record_id`, what `--flatten` asks for). The CLI's own help already
  uses this word; the code spells it `flatten: boolean`.

Saying "layout" for the flatten axis is the mistake worth naming: it reads as a
claim about `--separate-files`, which has nothing to do with whether fields are
nested. Do not call **structure** a *shape* either — that word is taken, by the
wire format and the SDK shape.

All three are inputs to `generateFromSchema`, which is the single place a base schema
becomes source text. Everything above it — fetching, environment resolution,
writing to disk or stdout — decides only *where the bytes go*. That split is not
tidiness: the assembly previously existed in three copies, and they drifted far
enough that `--separate-files --typescript-only` emitted fewer utility types
than the single-file run of the same base.
