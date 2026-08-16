export interface AirtableField {
  id: string;
  name: string;
  type: string;
  options?: Record<string, any>;
  description?: string;
  isComputed?: boolean;
  isReadonly?: boolean;
}

export interface AirtableView {
  id: string;
  name: string;
  type: string;
  visibleFieldIds?: string[];
}

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: AirtableField[];
  views: AirtableView[];
  description?: string;
}

export interface AirtableBaseSchema {
  tables: AirtableTable[];
}

export interface TypeMappingResult {
  type: string;
  readonly: boolean;
  strictType: string;
  description?: string;
}

export interface GenerateOptions {
  baseId: string;
  token: string;
  flatten?: boolean;
  tables?: string[];
}

/** What the generated source is written in. */
export type OutputFormat = 'zod' | 'typescript';

/** Whether the base lands in one module or one module per table. */
export type OutputLayout = 'single' | 'separate';

/**
 * What an emitter needs beyond the schema itself. `flatten` selects the
 * structure — native (fields nested under `fields`) or flattened.
 */
export interface EmitOptions {
  format: OutputFormat;
  flatten?: boolean;
}

export interface AirtableAiTextValue {
  state: 'generated' | 'pending' | 'error' | 'empty';
  value: string;
  isStale: boolean;
}

export interface GenerateResult {
  content: string;
  schema: AirtableBaseSchema;
}
