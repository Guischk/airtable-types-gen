import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateRecord,
  safeValidateRecord,
  validateRecords,
  safeValidateRecords,
  createUpdateSchema,
  createCreationSchema,
  formatZodError,
  createValidator,
  airtableSchemaHelpers,
} from '../../src/runtime/zod-utils.js';

describe('Zod Utils', () => {
  const testSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    age: z.number().min(0),
    isActive: z.boolean(),
  });

  type TestType = z.infer<typeof testSchema>;

  const validData = {
    id: 'rec123',
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    isActive: true,
  };

  const invalidData = {
    id: 'rec123',
    name: 'John Doe',
    email: 'invalid-email',
    age: -5,
    isActive: 'not-boolean',
  };

  describe('validateRecord', () => {
    it('should validate valid data', () => {
      const result = validateRecord(testSchema, validData);
      expect(result).toEqual(validData);
    });

    it('should throw error for invalid data', () => {
      expect(() => validateRecord(testSchema, invalidData)).toThrow();
    });
  });

  describe('safeValidateRecord', () => {
    it('should return success for valid data', () => {
      const result = safeValidateRecord(testSchema, validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should return error for invalid data', () => {
      const result = safeValidateRecord(testSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateRecords', () => {
    it('should validate array of valid records', () => {
      const data = [validData, { ...validData, id: 'rec456' }];
      const result = validateRecords(testSchema, data);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(validData);
    });

    it('should throw error if any record is invalid', () => {
      const data = [validData, invalidData];
      expect(() => validateRecords(testSchema, data)).toThrow();
    });
  });

  describe('safeValidateRecords', () => {
    it('should separate valid and invalid records', () => {
      const data = [validData, invalidData, { ...validData, id: 'rec789' }];

      const result = safeValidateRecords(testSchema, data);

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].index).toBe(1);
      expect(result.invalid[0].data).toBe(invalidData);
      expect(result.invalid[0].error).toBeInstanceOf(z.ZodError);
    });

    it('should handle all valid records', () => {
      const data = [validData, { ...validData, id: 'rec456' }];
      const result = safeValidateRecords(testSchema, data);

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(0);
    });

    it('should handle all invalid records', () => {
      const data = [invalidData, { ...invalidData, id: 'rec456' }];
      const result = safeValidateRecords(testSchema, data);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(2);
    });
  });

  describe('createUpdateSchema', () => {
    it('should make all fields optional', () => {
      const updateSchema = createUpdateSchema(testSchema);

      // Should accept partial data
      const partialData = { name: 'Jane Doe' };
      const result = updateSchema.parse(partialData);
      expect(result).toEqual(partialData);

      // Should accept full data
      const fullResult = updateSchema.parse(validData);
      expect(fullResult).toEqual(validData);

      // Should accept empty object
      const emptyResult = updateSchema.parse({});
      expect(emptyResult).toEqual({});
    });
  });

  describe('createCreationSchema', () => {
    it('should exclude readonly fields', () => {
      const creationSchema = createCreationSchema(testSchema, ['id']);

      // Should work without id field
      const dataWithoutId = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        age: 25,
        isActive: false,
      };

      const result = creationSchema.parse(dataWithoutId);
      expect(result).toEqual(dataWithoutId);

      // Should fail if required fields are missing
      expect(() => creationSchema.parse({ name: 'Jane' })).toThrow();
    });

    it('should work with no readonly fields', () => {
      const creationSchema = createCreationSchema(testSchema, []);
      const result = creationSchema.parse(validData);
      expect(result).toEqual(validData);
    });
  });

  describe('formatZodError', () => {
    it('should format validation errors readably', () => {
      try {
        testSchema.parse(invalidData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodError(error);
          expect(formatted).toContain('email:');
          expect(formatted).toContain('age:');
          expect(formatted).toContain('isActive:');
        }
      }
    });

    it('should handle nested path errors', () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
          }),
        }),
      });

      try {
        nestedSchema.parse({ user: { profile: { name: 123 } } });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodError(error);
          expect(formatted).toContain('user.profile.name:');
        }
      }
    });
  });

  describe('createValidator', () => {
    const validator = createValidator(testSchema);

    it('should create validator with all methods', () => {
      expect(validator.validate).toBeInstanceOf(Function);
      expect(validator.safeValidate).toBeInstanceOf(Function);
      expect(validator.validateMany).toBeInstanceOf(Function);
      expect(validator.safeValidateMany).toBeInstanceOf(Function);
    });

    it('should validate single record', () => {
      const result = validator.validate(validData);
      expect(result).toEqual(validData);
    });

    it('should safe validate single record', () => {
      const result = validator.safeValidate(validData);
      expect(result.success).toBe(true);
    });

    it('should validate multiple records', () => {
      const data = [validData, { ...validData, id: 'rec456' }];
      const result = validator.validateMany(data);
      expect(result).toHaveLength(2);
    });

    it('should safe validate multiple records', () => {
      const data = [validData, invalidData];
      const result = validator.safeValidateMany(data);
      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(1);
    });
  });

  describe('airtableSchemaHelpers', () => {
    describe('recordId', () => {
      it('should create valid record ID schema', () => {
        const schema = airtableSchemaHelpers.recordId();

        expect(schema.parse('rec123')).toBe('rec123');
        expect(() => schema.parse('')).toThrow();
        expect(() => schema.parse(123)).toThrow();
      });
    });

    describe('timestamp', () => {
      it('should validate ISO datetime strings', () => {
        const schema = airtableSchemaHelpers.timestamp();

        expect(schema.parse('2023-12-01T10:00:00.000Z')).toBe('2023-12-01T10:00:00.000Z');
        expect(() => schema.parse('invalid-date')).toThrow();
        expect(() => schema.parse('2023-12-01')).toThrow();
      });
    });

    describe('attachment', () => {
      it('should validate attachment objects', () => {
        const schema = airtableSchemaHelpers.attachment();

        const validAttachment = {
          id: 'att123',
          url: 'https://example.com/file.pdf',
          filename: 'document.pdf',
          size: 1024,
          type: 'application/pdf',
        };

        expect(schema.parse(validAttachment)).toEqual(validAttachment);

        expect(() =>
          schema.parse({
            id: 'att123',
            url: 'invalid-url',
            filename: 'doc.pdf',
            size: -1,
            type: 'pdf',
          })
        ).toThrow();
      });
    });

    describe('user', () => {
      it('should validate user objects', () => {
        const schema = airtableSchemaHelpers.user();

        const validUser = {
          id: 'usr123',
          email: 'user@example.com',
          name: 'John Doe',
        };

        expect(schema.parse(validUser)).toEqual(validUser);

        expect(() =>
          schema.parse({
            id: 'usr123',
            email: 'invalid-email',
            name: 'John',
          })
        ).toThrow();
      });
    });

    describe('linkedRecords', () => {
      it('should validate array of record IDs', () => {
        const schema = airtableSchemaHelpers.linkedRecords();

        expect(schema.parse(['rec123', 'rec456'])).toEqual(['rec123', 'rec456']);
        expect(schema.parse([])).toEqual([]);

        expect(() => schema.parse(['rec123', 123])).toThrow();
        expect(() => schema.parse('not-an-array')).toThrow();
      });
    });

    describe('optional', () => {
      it('should make fields optional and nullable', () => {
        const baseSchema = z.string();
        const optionalSchema = airtableSchemaHelpers.optional(baseSchema);

        expect(optionalSchema.parse('test')).toBe('test');
        expect(optionalSchema.parse(null)).toBe(null);
        expect(optionalSchema.parse(undefined)).toBe(undefined);
      });
    });
  });
});
