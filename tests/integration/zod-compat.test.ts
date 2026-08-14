import { describe, it, expect } from 'vitest';
import { z as zod4 } from 'zod';
import { z as zod3 } from 'zod-v3';
import { mapAirtableTypeToZod } from '../../src/generator/zod-schema.js';
import { generateTableZodSchema } from '../../src/generator/zod-generator.js';
import { AirtableField, AirtableTable } from '../../src/types.js';

/**
 * The generator emits Zod source text rather than building schema objects, so
 * `zod` is an optional peer spanning both majors. Nothing in the type system
 * enforces that the emitted text is valid on both — these tests do, by actually
 * evaluating every expression against each major.
 */

/** Every Airtable field type the generator claims to map, plus a fallback. */
const FIELD_TYPES: AirtableField[] = [
  { id: 'f1', name: 'Text', type: 'singleLineText' },
  { id: 'f2', name: 'Long', type: 'multilineText' },
  { id: 'f3', name: 'Rich', type: 'richText' },
  { id: 'f4', name: 'Email', type: 'email' },
  { id: 'f5', name: 'Url', type: 'url' },
  { id: 'f6', name: 'Phone', type: 'phoneNumber' },
  { id: 'f7', name: 'Num', type: 'number' },
  { id: 'f8', name: 'Money', type: 'currency' },
  { id: 'f9', name: 'Pct', type: 'percent' },
  { id: 'f10', name: 'Stars', type: 'rating' },
  { id: 'f11', name: 'Dur', type: 'duration' },
  { id: 'f12', name: 'Check', type: 'checkbox' },
  {
    id: 'f13',
    name: 'Select',
    type: 'singleSelect',
    options: { choices: [{ name: "User's choice" }, { name: 'Plain' }] },
  },
  {
    id: 'f14',
    name: 'Multi',
    type: 'multipleSelects',
    options: { choices: [{ name: 'a "quoted" tag' }, { name: 'back\\slash' }] },
  },
  { id: 'f15', name: 'Date', type: 'date' },
  { id: 'f16', name: 'DateTime', type: 'dateTime' },
  { id: 'f17', name: 'Created', type: 'createdTime' },
  { id: 'f18', name: 'Modified', type: 'lastModifiedTime' },
  { id: 'f19', name: 'Files', type: 'multipleAttachments' },
  { id: 'f20', name: 'Links', type: 'multipleRecordLinks' },
  { id: 'f21', name: 'Formula', type: 'formula', options: { result: { type: 'number' } } },
  { id: 'f22', name: 'Rollup', type: 'rollup' },
  { id: 'f23', name: 'Count', type: 'count' },
  { id: 'f24', name: 'Lookup', type: 'lookup' },
  { id: 'f25', name: 'By', type: 'createdBy' },
  { id: 'f26', name: 'ModBy', type: 'lastModifiedBy' },
  { id: 'f27', name: 'Collab', type: 'singleCollaborator' },
  { id: 'f28', name: 'Collabs', type: 'multipleCollaborators' },
  { id: 'f29', name: 'Barcode', type: 'barcode' },
  { id: 'f30', name: 'Button', type: 'button' },
  { id: 'f31', name: 'Auto', type: 'autoNumber' },
  { id: 'f32', name: 'Lookups', type: 'multipleLookupValues' },
  { id: 'f33', name: 'Ai', type: 'aiText' },
];

/** Build the emitted expression into a live schema using the given Zod major. */
const evaluate = (expression: string, z: unknown): unknown =>
  new Function('z', `return ${expression};`)(z);

describe('Emitted Zod expressions are valid on both Zod majors', () => {
  for (const major of [
    { label: 'zod 3', z: zod3 },
    { label: 'zod 4', z: zod4 },
  ]) {
    describe(major.label, () => {
      it.each(FIELD_TYPES.map((f) => [f.type, f] as const))(
        'builds a working schema for %s',
        (_type, field) => {
          const { expression } = mapAirtableTypeToZod(field);
          const schema = evaluate(expression, major.z) as { safeParse: (v: unknown) => unknown };

          expect(schema).toBeDefined();
          // A live schema must be able to run: the result shape matters less
          // than the absence of a throw from Zod's internals.
          expect(() => schema.safeParse(undefined)).not.toThrow();
        }
      );

      it('supports the readonly and optional modifiers the generator appends', () => {
        const { expression } = mapAirtableTypeToZod(FIELD_TYPES[0]);
        expect(() => evaluate(`${expression}.readonly().optional()`, major.z)).not.toThrow();
      });

      it('round-trips a select choice containing a quote', () => {
        const field = FIELD_TYPES.find((f) => f.type === 'singleSelect')!;
        const { expression } = mapAirtableTypeToZod(field);
        const schema = evaluate(expression, major.z) as {
          parse: (v: unknown) => unknown;
        };

        expect(schema.parse("User's choice")).toBe("User's choice");
      });
    });
  }
});

describe('Hostile table and field names still produce parseable output', () => {
  const buildTable = (overrides: Partial<AirtableTable>): AirtableTable => ({
    id: 'tbl1',
    name: 'Table',
    primaryFieldId: 'f1',
    fields: [{ id: 'f1', name: 'Name', type: 'singleLineText' }],
    views: [],
    ...overrides,
  });

  it('prefixes a table name starting with a digit', () => {
    const result = generateTableZodSchema(buildTable({ name: '2024 Sales' }));
    expect(result).toContain('export const Table2024SalesSchema =');
    expect(result).not.toMatch(/export const 2024/);
  });

  it('falls back to a usable name when nothing survives sanitising', () => {
    const result = generateTableZodSchema(buildTable({ name: '🚀🚀🚀' }));
    expect(result).toContain('export const TableSchema =');
  });

  it('does not let a description close the JSDoc comment early', () => {
    const result = generateTableZodSchema(
      buildTable({
        fields: [
          { id: 'f1', name: 'Name', type: 'singleLineText', description: 'ends here */ and code' },
        ],
      })
    );

    const commentLine = result.split('\n').find((l) => l.includes('ends here'))!;
    expect(commentLine.endsWith('*/')).toBe(true);
    expect(commentLine.indexOf('*/')).toBe(commentLine.lastIndexOf('*/'));
  });

  it('quotes a field name containing a backslash or quote', () => {
    const result = generateTableZodSchema(
      buildTable({ fields: [{ id: 'f1', name: 'weird\\name"x', type: 'singleLineText' }] }),
      true
    );

    expect(result).toContain(JSON.stringify('weird\\name"x'));
  });

  it('escapes select choices containing quotes in the enum', () => {
    const result = generateTableZodSchema(
      buildTable({
        fields: [
          {
            id: 'f1',
            name: 'Status',
            type: 'singleSelect',
            options: { choices: [{ name: "User's" }, { name: 'a "b"' }] },
          },
        ],
      }),
      true
    );

    expect(result).toContain('z.enum(["User\'s", "a \\"b\\""])');
  });
});
