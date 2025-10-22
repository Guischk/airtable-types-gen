import { z } from 'zod';
import { AirtableField } from '../types.js';
import { enrichFieldMetadata } from './schema.js';

export interface ZodMappingResult {
  schema: z.ZodType<any>;
  readonly: boolean;
  description?: string;
}

export const mapAirtableTypeToZod = (field: AirtableField): ZodMappingResult => {
  const enrichedField = enrichFieldMetadata(field);
  const readonly = enrichedField.isReadonly || false;

  let schema: z.ZodType<any>;
  let description: string | undefined;

  switch (field.type) {
    case 'singleLineText':
    case 'multilineText':
    case 'richText':
      schema = z.string();
      break;

    case 'email':
      schema = z.string().email('Invalid email format');
      break;

    case 'url':
      schema = z.string().url('Invalid URL format');
      break;

    case 'phoneNumber':
      // eslint-disable-next-line no-useless-escape
      schema = z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format');
      break;

    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
      schema = z.number();
      break;

    case 'checkbox':
      schema = z.boolean();
      break;

    case 'singleSelect':
      if (field.options?.choices) {
        const choices = field.options.choices.map((choice: any) => choice.name) as [
          string,
          ...string[],
        ];
        schema = z.enum(choices);
      } else {
        schema = z.string();
      }
      break;

    case 'multipleSelects':
      if (field.options?.choices) {
        const choices = field.options.choices.map((choice: any) => choice.name) as [
          string,
          ...string[],
        ];
        schema = z.array(z.enum(choices));
      } else {
        schema = z.array(z.string());
      }
      break;

    case 'date':
      schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');
      description = 'ISO date string';
      break;

    case 'dateTime':
      schema = z.string().datetime('Invalid ISO datetime format');
      description = 'ISO datetime string';
      break;

    case 'createdTime':
    case 'lastModifiedTime':
      schema = z.string().datetime('Invalid ISO datetime format');
      description = readonly
        ? '🔒 Computed by Airtable - readonly ISO datetime string'
        : 'ISO datetime string';
      break;

    case 'multipleAttachments':
      schema = z.array(
        z.object({
          id: z.string(),
          url: z.string().url(),
          filename: z.string(),
          size: z.number().positive(),
          type: z.string(),
        })
      );
      break;

    case 'multipleRecordLinks':
      schema = z.array(z.string());
      description = 'Array of linked record IDs';
      break;

    case 'formula':
      if (field.options?.result?.type === 'number') {
        schema = z.number();
      } else if (field.options?.result?.type === 'currency') {
        schema = z.number();
      } else if (field.options?.result?.type === 'text') {
        schema = z.string();
      } else {
        schema = z.string();
      }
      description = readonly ? '🔒 Computed by Airtable - formula result' : 'Formula result';
      break;

    case 'rollup':
      schema = z.union([z.string(), z.number()]);
      description = readonly
        ? '🔒 Computed by Airtable - aggregated values from linked records'
        : 'Rollup values';
      break;

    case 'count':
      schema = z.number().int().min(0);
      description = readonly
        ? '🔒 Computed by Airtable - count of linked records'
        : 'Count of linked records';
      break;

    case 'lookup':
      schema = z.array(z.string());
      description = readonly
        ? '🔒 Computed by Airtable - values from linked records'
        : 'Lookup values';
      break;

    case 'createdBy':
    case 'lastModifiedBy':
      schema = z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string(),
      });
      description = readonly ? '🔒 Computed by Airtable - user information' : 'User information';
      break;

    case 'barcode':
      schema = z.object({
        text: z.string(),
        type: z.string(),
      });
      break;

    case 'button':
      schema = z.object({
        label: z.string(),
        url: z.string().url(),
      });
      break;

    case 'autoNumber':
      schema = z.number().int().positive();
      description = readonly
        ? '🔒 Computed by Airtable - auto-incrementing number'
        : 'Auto-incrementing number';
      break;

    case 'multipleLookupValues':
      schema = z.array(z.string());
      description = readonly
        ? '🔒 Computed by Airtable - multiple lookup values'
        : 'Multiple lookup values';
      break;

    case 'aiText':
      schema = z.object({
        state: z.enum(['generated', 'pending', 'error', 'empty', "quote's"]),
        value: z.string(),
        isStale: z.boolean(),
      });
      description = readonly
        ? '🔒 Computed by Airtable - AI generated text object'
        : 'AI generated text object';
      break;

    default:
      console.warn(`[Zod Schema] Unknown field type: ${field.type}`);
      schema = z.string();
      break;
  }

  // Note: Optionality is now handled at the generator level for consistency with TypeScript

  return {
    schema,
    readonly,
    description,
  };
};

export const generatePropertyName = (fieldName: string): string => {
  return fieldName;
};

export const generateSchemaName = (tableName: string): string => {
  const cleanName = tableName
    // Replace special characters and spaces with underscores
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/[\s-]+/g, '_')
    // Split on underscores and capitalize each word
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  return cleanName + 'Schema';
};

export const generateTypeName = (tableName: string): string => {
  const cleanName = tableName
    // Replace special characters and spaces with underscores
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/[\s-]+/g, '_')
    // Split on underscores and capitalize each word
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  return cleanName + 'Record';
};
