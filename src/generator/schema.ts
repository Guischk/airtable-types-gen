import { AirtableBaseSchema, AirtableField, AirtableTable, TypeMappingResult } from '../types.js';

// Types de champs calculés par Airtable (readonly)
const COMPUTED_FIELD_TYPES = [
  'formula',
  'rollup',
  'count',
  'lookup',
  'createdTime',
  'lastModifiedTime',
  'createdBy',
  'lastModifiedBy',
  'autoNumber',
  'aiText',
] as const;

export const detectComputedField = (field: AirtableField): boolean => {
  return COMPUTED_FIELD_TYPES.includes(field.type as any);
};

export const enrichFieldMetadata = (field: AirtableField): AirtableField => {
  const isComputed = detectComputedField(field);
  return {
    ...field,
    isComputed,
    isReadonly: isComputed,
  };
};

export const fetchBaseSchema = async (
  baseId: string,
  token: string
): Promise<AirtableBaseSchema> => {
  try {
    // Progress goes to stderr: stdout carries the generated module when the CLI
    // is used as `airtable-types-gen > schemas.ts`.
    console.error(`[Schema] Fetching base schema for ${baseId}`);

    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: unknown = await response.json();

    console.error(
      `[Schema] Successfully fetched schema for ${(data as any)?.tables?.length || 0} tables`
    );

    return data as AirtableBaseSchema;
  } catch (error) {
    console.error('[Schema] Error fetching base schema:', error);
    throw error;
  }
};

export const mapAirtableTypeToTSEnhanced = (field: AirtableField): TypeMappingResult => {
  const enrichedField = enrichFieldMetadata(field);
  const readonly = enrichedField.isReadonly || false;

  let type: string;
  let strictType: string;
  let description: string | undefined;

  switch (field.type) {
    case 'singleLineText':
    case 'multilineText':
    case 'richText':
    case 'email':
    case 'url':
    case 'phoneNumber':
      type = strictType = 'string';
      break;

    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
      type = strictType = 'number';
      break;

    case 'duration':
      type = strictType = 'number';
      description = 'Duration in seconds';
      break;

    case 'checkbox':
      type = strictType = 'boolean';
      break;

    case 'singleSelect':
      if (field.options?.choices) {
        const choices = field.options.choices
          .map((choice: any) => JSON.stringify(choice.name))
          .join(' | ');
        type = strictType = choices || 'string';
      } else {
        type = strictType = 'string';
      }
      break;

    case 'multipleSelects':
      if (field.options?.choices) {
        const choices = field.options.choices
          .map((choice: any) => JSON.stringify(choice.name))
          .join(' | ');
        type = strictType = `Array<${choices || 'string'}>`;
      } else {
        type = strictType = 'string[]';
      }
      break;

    case 'date':
    case 'dateTime':
      type = strictType = 'string';
      description = 'ISO date string';
      break;

    case 'createdTime':
    case 'lastModifiedTime':
      type = strictType = 'string';
      description = readonly
        ? '🔒 Computed by Airtable - readonly ISO date string'
        : 'ISO date string';
      break;

    case 'multipleAttachments':
      type = strictType =
        'Array<{ id: string; url: string; filename: string; size: number; type: string }>';
      break;

    case 'multipleRecordLinks':
      type = strictType = 'string[]';
      description = 'Array of linked record IDs';
      break;

    case 'formula':
      if (field.options?.result?.type === 'number') {
        type = 'number';
        strictType = 'number';
      } else if (field.options?.result?.type === 'currency') {
        type = 'number';
        strictType = 'number';
      } else if (field.options?.result?.type === 'text') {
        type = 'string';
        strictType = 'string';
      } else {
        type = 'string';
        strictType = 'string';
      }
      description = readonly ? '🔒 Computed by Airtable - formula result' : 'Formula result';
      break;

    case 'rollup':
      type = 'string | number';
      strictType = 'string | number';
      description = readonly
        ? '🔒 Computed by Airtable - aggregated values from linked records'
        : 'Rollup values';
      break;

    case 'count':
      type = strictType = 'number';
      description = readonly
        ? '🔒 Computed by Airtable - count of linked records'
        : 'Count of linked records';
      break;

    case 'lookup':
      type = 'string[]';
      strictType = 'string[]';
      description = readonly
        ? '🔒 Computed by Airtable - values from linked records'
        : 'Lookup values';
      break;

    case 'createdBy':
    case 'lastModifiedBy':
    case 'singleCollaborator':
      type = strictType = '{ id: string; email: string; name: string }';
      description = readonly ? '🔒 Computed by Airtable - user information' : 'User information';
      break;

    case 'multipleCollaborators':
      type = strictType = 'Array<{ id: string; email: string; name: string }>';
      description = readonly ? '🔒 Computed by Airtable - collaborators' : 'Collaborators';
      break;

    case 'barcode':
      type = strictType = '{ text: string; type: string }';
      break;

    case 'button':
      type = strictType = '{ label: string; url: string }';
      break;

    case 'autoNumber':
      type = strictType = 'number';
      description = readonly
        ? '🔒 Computed by Airtable - auto-incrementing number'
        : 'Auto-incrementing number';
      break;

    case 'multipleLookupValues':
      type = 'string[]';
      strictType = 'string[]';
      description = readonly
        ? '🔒 Computed by Airtable - multiple lookup values'
        : 'Multiple lookup values';
      break;

    case 'aiText':
      type =
        '{ state: "generated" | "pending" | "error" | "empty"; value: string; isStale: boolean }';
      strictType = 'AirtableAiTextValue';
      description = readonly
        ? '🔒 Computed by Airtable - AI generated text object'
        : 'AI generated text object';
      break;

    default:
      console.warn(`[Schema] Unknown field type: ${field.type}`);
      type = 'string';
      strictType = 'string';
      break;
  }

  return {
    type,
    readonly,
    strictType,
    description,
  };
};

/**
 * Turn an Airtable table name into a PascalCase TypeScript identifier.
 *
 * Airtable accepts names TypeScript cannot: `2024 Sales` would yield an
 * identifier starting with a digit, and an emoji-only name would yield an empty
 * one. Both used to emit source that does not parse, so they are corrected here.
 *
 * Note: names that differ only by case or punctuation (`users` vs `Users`) still
 * collapse to the same identifier. That is a known limitation, not something
 * this function can resolve alone — it has no view of the other tables.
 */
export const toPascalCaseIdentifier = (tableName: string): string => {
  const cleanName = tableName
    // Replace special characters and spaces with underscores
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/[\s-]+/g, '_')
    // Split on underscores and capitalize each word
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  if (cleanName.length === 0) {
    return 'Table';
  }

  // A leading digit is legal in an Airtable name but not in a TS identifier.
  return /^[0-9]/.test(cleanName) ? `Table${cleanName}` : cleanName;
};

export const generateInterfaceName = (tableName: string): string =>
  `${toPascalCaseIdentifier(tableName)}Record`;

export const generatePropertyName = (fieldName: string): string => {
  return fieldName;
};

/**
 * Property name for every field of a table, disambiguated across the table.
 *
 * Airtable lets two fields share a name once punctuation is stripped, and lets a
 * field be called `id` next to the record's own `id`. Both need renaming, and
 * both emitters plus the writable-schema emitter must land on the *same* new
 * name — a mismatch would silently emit a schema whose keys do not line up with
 * the interface describing it. Hence one resolver rather than a copy per site.
 *
 * Keyed by field id, since the field name is exactly what may be rewritten.
 */
export const resolvePropertyNames = (
  table: AirtableTable,
  flatten: boolean
): Map<string, string> => {
  const used = new Set<string>();
  const resolved = new Map<string, string>();

  if (flatten) {
    used.add('record_id');
  }

  for (const field of table.fields) {
    let propertyName = generatePropertyName(field.name);

    if (flatten) {
      // The flattened structure puts fields next to `record_id`, so a field called
      // `id` has to move even when nothing else claims that name.
      if (used.has(propertyName) || propertyName === 'id') {
        if (propertyName === 'id') {
          propertyName =
            field.type === 'autoNumber'
              ? 'auto_id'
              : field.type === 'number'
                ? 'field_id'
                : `id_${field.type}`;
        } else {
          propertyName = `${propertyName}_${field.type}`;
        }
      }
    } else if (used.has(propertyName)) {
      propertyName =
        field.type === 'autoNumber'
          ? 'auto_id'
          : field.type === 'number' && propertyName === 'id'
            ? 'record_id'
            : `${propertyName}_${field.type}`;
    }

    used.add(propertyName);
    resolved.set(field.id, propertyName);
  }

  return resolved;
};
