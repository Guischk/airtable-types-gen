import { describe, it, expect } from 'vitest';
import {
  detectComputedField,
  isAlwaysPresentComputed,
  mapAirtableTypeToTSEnhanced,
  generateInterfaceName,
  generatePropertyName,
} from '../../src/generator/schema';
import { AirtableField } from '../../src/types';

describe('detectComputedField', () => {
  it('should detect computed field types', () => {
    const computedTypes = ['formula', 'rollup', 'count', 'lookup', 'createdTime', 'autoNumber'];

    computedTypes.forEach((type) => {
      const field: AirtableField = { id: 'test', name: 'Test', type };
      expect(detectComputedField(field)).toBe(true);
    });
  });

  it('should detect aiText as computed field type', () => {
    const field: AirtableField = { id: 'test', name: 'AI Summary', type: 'aiText' };
    expect(detectComputedField(field)).toBe(true);
  });

  it('should not detect non-computed field types as computed', () => {
    const nonComputedTypes = ['singleLineText', 'number', 'checkbox', 'email'];

    nonComputedTypes.forEach((type) => {
      const field: AirtableField = { id: 'test', name: 'Test', type };
      expect(detectComputedField(field)).toBe(false);
    });
  });
});

describe('isAlwaysPresentComputed', () => {
  it('should identify always present computed types', () => {
    const alwaysPresentTypes = ['autoNumber', 'createdTime', 'lastModifiedTime'];

    alwaysPresentTypes.forEach((type) => {
      const field: AirtableField = { id: 'test', name: 'Test', type };
      expect(isAlwaysPresentComputed(field)).toBe(true);
    });
  });

  it('should identify always present field names', () => {
    const alwaysPresentNames = ['airtable_id', 'id', 'ID', 'Airtable_ID'];

    alwaysPresentNames.forEach((name) => {
      const field: AirtableField = { id: 'test', name, type: 'singleLineText' };
      expect(isAlwaysPresentComputed(field)).toBe(true);
    });
  });
});

describe('mapAirtableTypeToTSEnhanced', () => {
  it('should map basic types correctly', () => {
    const testCases = [
      { type: 'singleLineText', expectedType: 'string' },
      { type: 'number', expectedType: 'number' },
      { type: 'checkbox', expectedType: 'boolean' },
      { type: 'email', expectedType: 'string' },
      { type: 'date', expectedType: 'string' },
    ];

    testCases.forEach(({ type, expectedType }) => {
      const field: AirtableField = { id: 'test', name: 'Test', type };
      const result = mapAirtableTypeToTSEnhanced(field);

      expect(result.type).toBe(expectedType);
      expect(result.strictType).toBe(expectedType);
    });
  });

  it('should handle singleSelect with choices', () => {
    const field: AirtableField = {
      id: 'test',
      name: 'Test',
      type: 'singleSelect',
      options: {
        choices: [{ name: 'Option A' }, { name: 'Option B' }, { name: 'Option C' }],
      },
    };

    const result = mapAirtableTypeToTSEnhanced(field);
    expect(result.type).toBe('"Option A" | "Option B" | "Option C"');
  });

  it('should handle multipleSelects with choices', () => {
    const field: AirtableField = {
      id: 'test',
      name: 'Test',
      type: 'multipleSelects',
      options: {
        choices: [{ name: 'Tag1' }, { name: 'Tag2' }],
      },
    };

    const result = mapAirtableTypeToTSEnhanced(field);
    expect(result.type).toBe('Array<"Tag1" | "Tag2">');
  });

  it('should mark computed fields as readonly', () => {
    const computedField: AirtableField = {
      id: 'test',
      name: 'Test',
      type: 'formula',
    };

    const result = mapAirtableTypeToTSEnhanced(computedField);
    expect(result.readonly).toBe(true);
    expect(result.description).toContain('🔒 Computed by Airtable');
  });

  it('should not mark regular fields as readonly', () => {
    const regularField: AirtableField = {
      id: 'test',
      name: 'Test',
      type: 'singleLineText',
    };

    const result = mapAirtableTypeToTSEnhanced(regularField);
    expect(result.readonly).toBe(false);
  });

  it('should map aiText fields to complex object structure', () => {
    const aiTextField: AirtableField = {
      id: 'test',
      name: 'Summary',
      type: 'aiText',
    };

    const result = mapAirtableTypeToTSEnhanced(aiTextField);
    expect(result.type).toBe(
      '{ state: "generated" | "pending" | "error" | "empty"; value: string; isStale: boolean }'
    );
    expect(result.strictType).toBe('AirtableAiTextValue');
    expect(result.description).toContain('AI generated text object');
  });

  it('should mark aiText fields as readonly when computed', () => {
    const aiTextField: AirtableField = {
      id: 'test',
      name: 'AI Summary',
      type: 'aiText',
    };

    const result = mapAirtableTypeToTSEnhanced(aiTextField);
    expect(result.readonly).toBe(true);
    expect(result.description).toContain('🔒 Computed by Airtable');
  });
});

describe('generateInterfaceName', () => {
  it('should generate clean interface names', () => {
    const testCases = [
      { input: 'Users', expected: 'UsersRecord' },
      { input: 'User Settings', expected: 'UserSettingsRecord' },
      { input: 'API Keys & Tokens', expected: 'ApiKeysTokensRecord' },
      { input: 'test-table_name', expected: 'TestTableNameRecord' },
    ];

    testCases.forEach(({ input, expected }) => {
      expect(generateInterfaceName(input)).toBe(expected);
    });
  });
});

describe('generatePropertyName', () => {
  it('should preserve original field names', () => {
    const testCases = [
      'Name',
      'Email Address',
      'Phone Number',
      'Created At',
      'Special!@#$%Characters',
    ];

    testCases.forEach((name) => {
      expect(generatePropertyName(name)).toBe(name);
    });
  });
});
