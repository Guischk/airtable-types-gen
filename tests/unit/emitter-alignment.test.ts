import { describe, it, expect } from 'vitest';
import { z as zod4 } from 'zod';
import { z as zod3 } from 'zod-v3';
import { generateTableZodSchema } from '../../src/generator/zod-generator';
import { generateTableInterface } from '../../src/generator/types';
import { ALL_FIELD_TYPES, allFieldTypesTable } from '../fixtures/field-types';

/**
 * The two emitters describe two stages of one pipeline: `--typescript-only`
 * describes what arrives from Airtable, the Zod output describes what leaves
 * `.parse()`. They are allowed to differ on the *output* side — `.default()`
 * legitimately makes a field non-optional once parsed — but they must agree on
 * what Airtable can omit, which is the *input* side.
 *
 * That agreement is what broke in issue #2: the same optionality expression was
 * duplicated across both emitters, and it was wrong in both.
 */

const evaluate = (
  expression: string,
  z: unknown
): { safeParse: (v: unknown) => { success: boolean } } =>
  new Function('z', `return ${expression};`)(z);

/** Property name → whether the emitted TypeScript line marks it optional. */
const interfaceOptionality = (source: string): Map<string, boolean> => {
  const result = new Map<string, boolean>();

  for (const line of source.split('\n')) {
    const match = /^ {2}(?:readonly )?(?:\["(.+)"\]|(\w+))(\?)?: /.exec(line);
    if (match) result.set(match[1] ?? match[2], match[3] === '?');
  }

  return result;
};

/** Property name → the emitted Zod expression. */
const schemaExpressions = (source: string): Map<string, string> => {
  const result = new Map<string, string>();

  for (const line of source.split('\n')) {
    const match = /^ {2}(?:\["(.+)"\]|(\w+)): (z\..*),$/.exec(line);
    if (match) result.set(match[1] ?? match[2], match[3]);
  }

  return result;
};

describe('TypeScript and Zod emitters agree on what Airtable can omit', () => {
  const optionality = interfaceOptionality(generateTableInterface(allFieldTypesTable, true));
  const expressions = schemaExpressions(generateTableZodSchema(allFieldTypesTable, true));

  it('emits an entry per field on both sides', () => {
    for (const field of ALL_FIELD_TYPES) {
      expect(optionality.has(field.name), `TS: ${field.name}`).toBe(true);
      expect(expressions.has(field.name), `Zod: ${field.name}`).toBe(true);
    }
  });

  it('marks every field optional in the TypeScript interface', () => {
    for (const field of ALL_FIELD_TYPES) {
      // Raw Airtable data guarantees no field at all, so every property is `?`.
      expect(optionality.get(field.name), `${field.type} (${field.name})`).toBe(true);
    }
  });

  it.each([
    ['zod 3', zod3],
    ['zod 4', zod4],
  ])('accepts an omitted value for every field on %s', (_label, z) => {
    for (const field of ALL_FIELD_TYPES) {
      const expression = expressions.get(field.name)!;
      const schema = evaluate(expression, z);

      expect(schema.safeParse(undefined).success, `${field.type} → ${expression}`).toBe(true);
    }
  });
});
