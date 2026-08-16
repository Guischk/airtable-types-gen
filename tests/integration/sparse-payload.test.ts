import { describe, it, expect } from 'vitest';
import { z as zod4 } from 'zod';
import { z as zod3 } from 'zod-v3';
import {
  generateTableZodSchema,
  generateTableWritableZodSchema,
} from '../../src/generator/zod-generator.js';
import { AirtableField, AirtableTable } from '../../src/types.js';
import {
  ALL_FIELD_TYPES,
  TYPES_WITH_EMPTY_VALUE,
  allFieldTypesTable,
} from '../fixtures/field-types.js';

/**
 * Airtable omits every empty cell from its responses:
 *
 *   "Returned records do not include any fields with 'empty' values,
 *    e.g. "", [], or false."
 *
 * A generated schema that marks those fields required rejects most real
 * records — the defect reported in issue #2. These tests run the emitted
 * source against both Zod majors and feed it the payloads Airtable actually
 * sends.
 */

interface AnySchema {
  parse: (value: unknown) => unknown;
  safeParse: (value: unknown) => { success: boolean; error?: { issues: unknown[] } };
}

/**
 * Turn emitted module source into a live schema.
 *
 * The generator emits text, so the only way to assert on runtime behaviour is
 * to execute that text. Import/export statements and type aliases are dropped:
 * they are TypeScript-or-module syntax that `new Function` cannot take.
 */
const buildSchema = (source: string, z: unknown, exportName: string): AnySchema => {
  const body = source
    .split('\n')
    .filter((line) => !/^\s*(import|export)\b.*\bfrom\b/.test(line))
    .map((line) => line.replace(/^export /, ''))
    .filter((line) => !/^\s*type\s/.test(line))
    .join('\n');

  return new Function('z', `${body}\nreturn ${exportName};`)(z) as AnySchema;
};

const singleFieldTable = (field: AirtableField): AirtableTable => ({
  id: 'tblOne',
  name: 'One',
  primaryFieldId: field.id,
  fields: [field],
  views: [],
});

/** A record whose every cell is empty, exactly as Airtable serialises it. */
const emptyRecord = { id: 'recEmpty', createdTime: '2026-08-15T10:00:00.000Z', fields: {} };

const MAJORS = [
  { label: 'zod 3', z: zod3 },
  { label: 'zod 4', z: zod4 },
];

describe.each(MAJORS)('Sparse Airtable payloads ($label)', ({ z }) => {
  it('parses a record in which every single cell is empty', () => {
    const schema = buildSchema(generateTableZodSchema(allFieldTypesTable), z, 'EverythingSchema');

    const result = schema.safeParse(emptyRecord);
    expect(result.success).toBe(true);
  });

  it.each(ALL_FIELD_TYPES.map((f) => [f.type, f] as const))(
    'accepts an omitted %s cell',
    (_type, field) => {
      const schema = buildSchema(generateTableZodSchema(singleFieldTable(field)), z, 'OneSchema');

      expect(schema.safeParse(emptyRecord).success).toBe(true);
    }
  );

  it('restores the value Airtable omitted, for the types whose empty value is documented', () => {
    const schema = buildSchema(generateTableZodSchema(allFieldTypesTable), z, 'EverythingSchema');
    const parsed = schema.parse(emptyRecord) as { fields: Record<string, unknown> };

    for (const field of ALL_FIELD_TYPES) {
      const expected = TYPES_WITH_EMPTY_VALUE[field.type];
      if (expected === undefined) continue;
      expect(parsed.fields[field.name], `${field.type} (${field.name})`).toEqual(expected);
    }
  });

  it('invents nothing for the types whose omission carries no known value', () => {
    const schema = buildSchema(generateTableZodSchema(allFieldTypesTable), z, 'EverythingSchema');
    const parsed = schema.parse(emptyRecord) as { fields: Record<string, unknown> };

    for (const field of ALL_FIELD_TYPES) {
      if (TYPES_WITH_EMPTY_VALUE[field.type] !== undefined) continue;
      // An absent number is not 0 and an absent date is not the epoch.
      expect(parsed.fields[field.name], `${field.type} (${field.name})`).toBeUndefined();
    }
  });

  it('accepts its own output, so parsing is idempotent', () => {
    const schema = buildSchema(generateTableZodSchema(allFieldTypesTable), z, 'EverythingSchema');
    const once = schema.parse(emptyRecord);

    expect(schema.safeParse(once).success).toBe(true);
  });

  it('still rejects a value of the wrong type', () => {
    const schema = buildSchema(generateTableZodSchema(allFieldTypesTable), z, 'EverythingSchema');

    expect(schema.safeParse({ ...emptyRecord, fields: { Num: 'not a number' } }).success).toBe(
      false
    );
    expect(schema.safeParse({ ...emptyRecord, fields: { Email: 'not an email' } }).success).toBe(
      false
    );
  });

  it('parses the sparse flattened structure too', () => {
    const schema = buildSchema(
      generateTableZodSchema(allFieldTypesTable, true),
      z,
      'EverythingSchema'
    );

    const result = schema.safeParse({ record_id: 'recEmpty' });
    expect(result.success).toBe(true);
  });

  it('reproduces the exact record from issue #2', () => {
    // Empty linked records, empty text, unchecked box — all omitted by Airtable.
    const table: AirtableTable = {
      id: 'tblUsers',
      name: 'Users',
      primaryFieldId: 'fldName',
      fields: [
        { id: 'fldName', name: 'Name', type: 'singleLineText' },
        { id: 'fldNotes', name: 'Notes', type: 'multilineText' },
        { id: 'fldAge', name: 'Age', type: 'number' },
        { id: 'fldActive', name: 'IsActive', type: 'checkbox' },
        { id: 'fldProjects', name: 'Projects', type: 'multipleRecordLinks' },
      ],
      views: [],
    };
    const schema = buildSchema(generateTableZodSchema(table), z, 'UsersSchema');

    const parsed = schema.parse({
      id: 'recABC123',
      createdTime: '2026-08-15T10:00:00.000Z',
      fields: { Name: 'Ada' },
    }) as { fields: Record<string, unknown> };

    expect(parsed.fields).toEqual({ Name: 'Ada', Notes: '', IsActive: false, Projects: [] });
  });
});

describe.each(MAJORS)('Writable schemas never resurrect an empty value ($label)', ({ z }) => {
  // The invariant is the same in both structures; only the payload differs.
  // Native writes reach Airtable as `{ id, fields }`, flattened ones are flat.
  describe('flattened', () => {
    const source = generateTableWritableZodSchema(allFieldTypesTable, true);

    it('leaves an update payload exactly as the caller wrote it', () => {
      const schema = buildSchema(source, z, 'EverythingUpdateSchema');

      // The read schema would fill Text with '' and Check with false here. Sent
      // as a PATCH that would blank cells the caller never mentioned.
      expect(schema.parse({ Text: 'hello' })).toEqual({ Text: 'hello' });
    });

    it('leaves a creation payload exactly as the caller wrote it', () => {
      const schema = buildSchema(source, z, 'EverythingCreationSchema');

      expect(schema.parse({ Text: 'hello' })).toEqual({ Text: 'hello' });
    });

    it('excludes computed fields, which cannot be written', () => {
      const schema = buildSchema(source, z, 'EverythingCreationSchema');

      // `Formula` is computed; Zod objects strip unknown keys rather than fail.
      expect(schema.parse({ Formula: 42 })).toEqual({});
    });
  });

  /**
   * A write does not send back what a read returned. Airtable uploads an
   * attachment from a `url` and assigns its id, size and type itself; a
   * collaborator is addressed by `id` *or* `email`; a barcode's `type` is
   * optional. Reusing the read expression here rejected all three.
   */
  describe('composite cells accept what Airtable accepts on a write', () => {
    const composite: AirtableTable = {
      id: 'tblW',
      name: 'W',
      primaryFieldId: 'f1',
      views: [],
      fields: [
        { id: 'f1', name: 'Files', type: 'multipleAttachments' },
        { id: 'f2', name: 'Collab', type: 'singleCollaborator' },
        { id: 'f3', name: 'Team', type: 'multipleCollaborators' },
        { id: 'f4', name: 'Code', type: 'barcode' },
      ],
    };
    const schema = () =>
      buildSchema(generateTableWritableZodSchema(composite, false), z, 'WCreationSchema');

    it.each([
      ['an attachment given only its url', { Files: [{ url: 'https://example.com/a.pdf' }] }],
      ['an attachment with a filename', { Files: [{ url: 'https://x.dev/a.pdf', filename: 'a.pdf' }] }],
      ['a collaborator by email', { Collab: { email: 'ada@example.com' } }],
      ['a collaborator by id', { Collab: { id: 'usrAda' } }],
      ['a team by id', { Team: [{ id: 'usrAda' }] }],
      ['a barcode without its type', { Code: { text: '0123456789' } }],
    ])('accepts %s', (_label, fields) => {
      expect(schema().safeParse({ fields }).success).toBe(true);
    });

    it('still rejects a barcode with no text at all', () => {
      expect(schema().safeParse({ fields: { Code: { type: 'upce' } } }).success).toBe(false);
    });

    // Widening the write shape must not widen it to "anything": an attachment
    // with neither a url to upload nor an id to keep, and a collaborator with
    // no way to name who, are payloads Airtable cannot act on either.
    it.each([
      ['an attachment identifying nothing', { Files: [{}] }],
      ['an attachment with only a filename', { Files: [{ filename: 'a.pdf' }] }],
      ['a collaborator identifying nobody', { Collab: {} }],
      ['a collaborator given only a name', { Collab: { name: 'Ada' } }],
    ])('rejects %s', (_label, fields) => {
      expect(schema().safeParse({ fields }).success).toBe(false);
    });
  });

  describe('native', () => {
    const source = generateTableWritableZodSchema(allFieldTypesTable, false);

    it('leaves an update payload exactly as the caller wrote it', () => {
      const schema = buildSchema(source, z, 'EverythingUpdateSchema');

      expect(schema.parse({ id: 'recABC123', fields: { Text: 'hello' } })).toEqual({
        id: 'recABC123',
        fields: { Text: 'hello' },
      });
    });

    it('leaves a creation payload exactly as the caller wrote it', () => {
      const schema = buildSchema(source, z, 'EverythingCreationSchema');

      expect(schema.parse({ fields: { Text: 'hello' } })).toEqual({ fields: { Text: 'hello' } });
    });

    it('excludes computed fields, which cannot be written', () => {
      const schema = buildSchema(source, z, 'EverythingCreationSchema');

      expect(schema.parse({ fields: { Formula: 42 } })).toEqual({ fields: {} });
    });
  });
});
