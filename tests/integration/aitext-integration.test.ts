import { describe, it, expect } from 'vitest';
import { generateTableInterface, generateAllTypes } from '../../src/generator/types';
import { generateTableZodSchema, generateUtilityZodTypes } from '../../src/generator/zod-generator';
import { mockSchema } from '../fixtures/mock-schema';

describe('AI Text Integration Tests', () => {
  it('should generate correct TypeScript types for aiText fields', () => {
    const usersTable = mockSchema.tables.find((t) => t.name === 'Users')!;
    const result = generateTableInterface(usersTable, true);

    // Check that aiText field is properly typed with the complex object structure
    expect(result).toContain(
      '["AI Summary"]?: { state: "generated" | "pending" | "error" | "empty"; value: string; isStale: boolean }'
    );

    // Check that it's marked as readonly since aiText is computed
    expect(result).toContain('readonly ["AI Summary"]?:');
  });

  it('should generate correct TypeScript types for aiText fields without flatten', () => {
    const usersTable = mockSchema.tables.find((t) => t.name === 'Users')!;
    const result = generateTableInterface(usersTable, false);

    // Check standard Airtable structure - it generates a separate fields interface
    expect(result).toContain('fields: UsersRecordFields;');
    expect(result).toContain(
      '["AI Summary"]?: { state: "generated" | "pending" | "error" | "empty"; value: string; isStale: boolean }'
    );
  });

  it('should generate correct Zod schema for aiText fields', () => {
    const usersTable = mockSchema.tables.find((t) => t.name === 'Users')!;
    const result = generateTableZodSchema(usersTable, true);

    // Check Zod object structure
    expect(result).toContain('["AI Summary"]: z.object({');
    expect(result).toContain(
      "state: z.enum(['generated', 'pending', 'error', 'empty', 'quote\\'s'])"
    );
    expect(result).toContain('value: z.string()');
    expect(result).toContain('isStale: z.boolean()');

    // Check readonly modifier since aiText is computed
    expect(result).toContain('}).readonly()');
  });

  it('should include aiText in readonly fields list', () => {
    const result = generateUtilityZodTypes(mockSchema, { flatten: true });

    // Check that aiText fields are marked in readonly arrays
    expect(result).toContain('UsersReadonlyFields');
    expect(result).toMatch(/["']AI Summary["']/);
  });

  it('should validate aiText data correctly', () => {
    const usersTable = mockSchema.tables.find((t) => t.name === 'Users')!;
    const zodSchema = generateTableZodSchema(usersTable, true);

    // The generated schema should be able to validate aiText structure
    expect(zodSchema).toContain('z.object({');
    expect(zodSchema).toContain(
      "state: z.enum(['generated', 'pending', 'error', 'empty', 'quote\\'s'])"
    );
    expect(zodSchema).toContain('value: z.string()');
    expect(zodSchema).toContain('isStale: z.boolean()');
  });

  it('should handle aiText field with all possible states', () => {
    const usersTable = mockSchema.tables.find((t) => t.name === 'Users')!;
    const result = generateTableZodSchema(usersTable, true);

    // All possible states should be in the enum
    expect(result).toContain("'generated'");
    expect(result).toContain("'pending'");
    expect(result).toContain("'error'");
    expect(result).toContain("'empty'");
  });

  it('should preserve field name with special characters in aiText', () => {
    // Create a test table with special characters in aiText field name
    const specialTable = {
      ...mockSchema.tables[0],
      fields: [
        ...mockSchema.tables[0].fields.slice(0, -1), // Remove last aiText field
        {
          id: 'fldSpecialAi',
          name: 'AI Summary & Analysis!',
          type: 'aiText' as const,
        },
      ],
    };

    const result = generateTableZodSchema(specialTable, true);

    // Should use bracket notation for special characters
    expect(result).toContain('["AI Summary & Analysis!"]: z.object({');
  });
});
