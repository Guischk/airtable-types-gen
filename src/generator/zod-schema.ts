import { AirtableField } from '../types.js';
import { enrichFieldMetadata, toPascalCaseIdentifier } from './schema.js';

/**
 * The generator emits Zod *source code*, it never builds a Zod schema object.
 *
 * Building a schema and then reverse-engineering it through `_def` used to work
 * on Zod 3 only: Zod 4 reshaped those internals (`_def.shape` is no longer a
 * function, string formats became subclasses instead of checks, ...). Emitting
 * the expression directly keeps this package agnostic to which Zod major the
 * consumer installed, which is why `zod` is a peer dependency spanning both.
 *
 * Every expression below is valid under Zod 3 and Zod 4 alike.
 */
export interface ZodMappingResult {
  /** Zod source expression, e.g. `z.string().email("Invalid email format")`. */
  expression: string;
  readonly: boolean;
  description?: string;
}

/** Airtable's collaborator/user payload, shared by several field types. */
const USER_EXPRESSION = 'z.object({ id: z.string(), email: z.string().email(), name: z.string() })';

const ATTACHMENT_EXPRESSION =
  'z.object({ id: z.string(), url: z.string().url(), filename: z.string(), ' +
  'size: z.number().positive(), type: z.string() })';

/**
 * A collaborator is addressed on a write by `id` *or* `email`, never both, and
 * `name` is never sent at all.
 */
const WRITE_USER_EXPRESSION =
  'z.object({ id: z.string().optional(), email: z.string().email().optional(), ' +
  'name: z.string().optional() })';

/**
 * Composite cells whose write shape is narrower than what comes back.
 *
 * Airtable fills most of these in for you: an attachment is uploaded from a
 * `url` and gains its id, size and type on the next read; a barcode's `type` is
 * optional. Reusing the read expression on the write path therefore rejects
 * payloads Airtable accepts — the read shape describes what *comes back*, not
 * what you may send. Every other type sends what it returns, so it falls
 * through to `mapAirtableTypeToZod` unchanged.
 */
const WRITE_EXPRESSIONS: Record<string, string> = {
  multipleAttachments:
    'z.array(z.object({ id: z.string().optional(), url: z.string().url().optional(), ' +
    'filename: z.string().optional() }))',
  singleCollaborator: WRITE_USER_EXPRESSION,
  multipleCollaborators: `z.array(${WRITE_USER_EXPRESSION})`,
  barcode: 'z.object({ text: z.string(), type: z.string().optional() })',
};

const PHONE_PATTERN = /^[\+]?[1-9][\d]{0,15}$/; // eslint-disable-line no-useless-escape
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const stringLiteral = (value: string): string => JSON.stringify(value);

const enumExpression = (choices: { name: string }[]): string =>
  `z.enum([${choices.map((choice) => stringLiteral(choice.name)).join(', ')}])`;

const readonlyNote = (readonly: boolean, computed: string, plain: string): string =>
  readonly ? `🔒 Computed by Airtable - ${computed}` : plain;

export const mapAirtableTypeToZod = (field: AirtableField): ZodMappingResult => {
  const readonly = enrichFieldMetadata(field).isReadonly || false;

  let expression: string;
  let description: string | undefined;

  switch (field.type) {
    case 'singleLineText':
    case 'multilineText':
    case 'richText':
      expression = 'z.string()';
      break;

    case 'email':
      expression = 'z.string().email("Invalid email format")';
      break;

    case 'url':
      expression = 'z.string().url("Invalid URL format")';
      break;

    case 'phoneNumber':
      expression = `z.string().regex(${PHONE_PATTERN}, "Invalid phone number format")`;
      break;

    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
      expression = 'z.number()';
      break;

    case 'duration':
      expression = 'z.number()';
      description = 'Duration in seconds';
      break;

    case 'checkbox':
      expression = 'z.boolean()';
      break;

    case 'singleSelect':
      expression = field.options?.choices ? enumExpression(field.options.choices) : 'z.string()';
      break;

    case 'multipleSelects':
      expression = field.options?.choices
        ? `z.array(${enumExpression(field.options.choices)})`
        : 'z.array(z.string())';
      break;

    case 'date':
      expression = `z.string().regex(${ISO_DATE_PATTERN}, "Invalid date format (YYYY-MM-DD)")`;
      description = 'ISO date string';
      break;

    case 'dateTime':
      expression = 'z.string().datetime("Invalid ISO datetime format")';
      description = 'ISO datetime string';
      break;

    case 'createdTime':
    case 'lastModifiedTime':
      expression = 'z.string().datetime("Invalid ISO datetime format")';
      description = readonlyNote(readonly, 'readonly ISO datetime string', 'ISO datetime string');
      break;

    case 'multipleAttachments':
      expression = `z.array(${ATTACHMENT_EXPRESSION})`;
      break;

    case 'multipleRecordLinks':
      expression = 'z.array(z.string())';
      description = 'Array of linked record IDs';
      break;

    case 'formula':
      expression =
        field.options?.result?.type === 'number' || field.options?.result?.type === 'currency'
          ? 'z.number()'
          : 'z.string()';
      description = readonlyNote(readonly, 'formula result', 'Formula result');
      break;

    case 'rollup':
      expression = 'z.union([z.string(), z.number()])';
      description = readonlyNote(
        readonly,
        'aggregated values from linked records',
        'Rollup values'
      );
      break;

    case 'count':
      expression = 'z.number().int().min(0)';
      description = readonlyNote(readonly, 'count of linked records', 'Count of linked records');
      break;

    case 'lookup':
      expression = 'z.array(z.string())';
      description = readonlyNote(readonly, 'values from linked records', 'Lookup values');
      break;

    case 'createdBy':
    case 'lastModifiedBy':
    case 'singleCollaborator':
      expression = USER_EXPRESSION;
      description = readonlyNote(readonly, 'user information', 'User information');
      break;

    case 'multipleCollaborators':
      expression = `z.array(${USER_EXPRESSION})`;
      description = readonlyNote(readonly, 'collaborators', 'Collaborators');
      break;

    case 'barcode':
      expression = 'z.object({ text: z.string(), type: z.string() })';
      break;

    case 'button':
      expression = 'z.object({ label: z.string(), url: z.string().url() })';
      break;

    case 'autoNumber':
      expression = 'z.number().int().positive()';
      description = readonlyNote(readonly, 'auto-incrementing number', 'Auto-incrementing number');
      break;

    case 'multipleLookupValues':
      expression = 'z.array(z.string())';
      description = readonlyNote(readonly, 'multiple lookup values', 'Multiple lookup values');
      break;

    case 'aiText':
      expression =
        'z.object({ state: z.enum(["generated", "pending", "error", "empty"]), ' +
        'value: z.string(), isStale: z.boolean() })';
      description = readonlyNote(readonly, 'AI generated text object', 'AI generated text object');
      break;

    default:
      console.warn(`[Zod Schema] Unknown field type: ${field.type}`);
      expression = 'z.string()';
      break;
  }

  // Optionality is applied by the generator so that Zod and TypeScript output stay aligned.
  return { expression, readonly, description };
};

export const generateSchemaName = (tableName: string): string =>
  `${toPascalCaseIdentifier(tableName)}Schema`;

export const generateTypeName = (tableName: string): string =>
  `${toPascalCaseIdentifier(tableName)}Record`;

/**
 * The write-path counterpart of `mapAirtableTypeToZod`.
 *
 * Read and write never share a schema object (see `CONTEXT.md`), and for
 * composite cells they cannot share an expression either. This is the one place
 * that difference lives.
 */
export const mapAirtableTypeToZodWrite = (field: AirtableField): ZodMappingResult => {
  const read = mapAirtableTypeToZod(field);
  const override = WRITE_EXPRESSIONS[field.type];
  return override ? { ...read, expression: override } : read;
};
