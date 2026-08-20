import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { z as zod4 } from 'zod';
import { z as zod3 } from 'zod-v3';
import { generateTableZodSchema } from '../../src/generator/zod-generator.js';
import { generateTableInterface } from '../../src/generator/types.js';
import type { AirtableTable } from '../../src/types.js';

/**
 * Everything user-controlled reaches the generated file as source text: table
 * names, field names, descriptions, select choices. A stray quote, backslash
 * or comment terminator in any of them can close a literal early and produce a
 * module that does not parse. `src/generator/emit.ts` centralises the escaping
 * for exactly that reason.
 *
 * Reported as #1 by @kaz-yamada for select choices, which the `ALL_FIELD_TYPES`
 * sweep already covers incidentally. The gap this file closes is **names**:
 * breaking `bracketedKey` — the TypeScript emitter's interface member keys —
 * left the whole suite green.
 *
 * The assertion is that the emitted source *parses*, never that it contains a
 * particular escape sequence. Validity is the property; spelling is not.
 */

const hostile = {
  apostrophe: "Jean's clinic",
  doubleQuote: 'He said "hi"',
  backslash: 'C:\\path\\to',
  commentTerminator: 'ends */ here',
  both: `mixed "quote" and 'apostrophe' and \\backslash`,
};

const hostileTable: AirtableTable = {
  id: 'tblHostile',
  name: hostile.doubleQuote,
  primaryFieldId: 'f1',
  views: [],
  fields: [
    { id: 'f1', name: hostile.apostrophe, type: 'singleLineText' },
    { id: 'f2', name: hostile.doubleQuote, type: 'number' },
    { id: 'f3', name: hostile.backslash, type: 'checkbox' },
    { id: 'f4', name: hostile.both, type: 'multilineText' },
    {
      id: 'f5',
      name: 'Described',
      type: 'singleLineText',
      description: hostile.commentTerminator,
    },
    {
      id: 'f6',
      name: 'Choices',
      type: 'singleSelect',
      options: { choices: [{ name: hostile.apostrophe }, { name: hostile.doubleQuote }] },
    },
  ],
};

/** Parse as TypeScript and surface any syntax error the emitter produced. */
const parseErrors = (source: string): string[] => {
  const file = ts.createSourceFile('generated.ts', source, ts.ScriptTarget.ES2022, true);
  // `parseDiagnostics` is internal but it is the only way to see syntax errors
  // without building a whole program for a single string.
  const diagnostics = (file as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;
  return (diagnostics ?? []).map((d) =>
    ts.flattenDiagnosticMessageText(d.messageText, ' ')
  );
};

/** Execute emitted Zod source; a broken literal throws a SyntaxError here. */
const executeZod = (source: string, z: unknown, exportName: string): unknown => {
  const body = source
    .split('\n')
    .filter((line) => !/^\s*(import|export)\b.*\bfrom\b/.test(line))
    .map((line) => line.replace(/^export /, ''))
    .filter((line) => !/^\s*type\s/.test(line))
    .join('\n');

  return new Function('z', `${body}\nreturn ${exportName};`)(z);
};

describe('hostile table, field and choice names', () => {
  describe.each([
    ['zod 3', zod3],
    ['zod 4', zod4],
  ])('the Zod emitter (%s)', (_label, z) => {
    it.each([true, false])('emits source that executes (flatten: %s)', (flatten) => {
      const source = generateTableZodSchema(hostileTable, flatten, { includeImport: false });
      const exportName = source.match(/export const (\w+Schema) = z\.object/)?.[1];

      expect(exportName, 'no schema export found in emitted source').toBeTruthy();
      expect(() => executeZod(source, z, exportName!)).not.toThrow();
    });
  });

  describe.each([true, false])('the TypeScript emitter (flatten: %s)', (flatten) => {
    it('emits source that parses', () => {
      expect(parseErrors(generateTableInterface(hostileTable, flatten))).toEqual([]);
    });
  });

  describe.each([true, false])('the Zod emitter as text (flatten: %s)', (flatten) => {
    it('emits source that parses', () => {
      expect(parseErrors(generateTableZodSchema(hostileTable, flatten))).toEqual([]);
    });
  });

  it('keeps the choice values intact rather than merely escaping them', () => {
    const source = generateTableZodSchema(hostileTable, true, { includeImport: false });
    const exportName = source.match(/export const (\w+Schema) = z\.object/)![1];
    const schema = executeZod(source, zod4, exportName) as {
      parse: (v: unknown) => Record<string, unknown>;
    };

    // Escaping that mangles the value would still parse and still be wrong.
    const parsed = schema.parse({ record_id: 'rec1', Choices: hostile.apostrophe });
    expect(parsed.Choices).toBe(hostile.apostrophe);
  });
});
