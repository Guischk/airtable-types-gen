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

export interface AirtableAiTextValue {
  state: 'generated' | 'pending' | 'error' | 'empty' | "quote's";
  value: string;
  isStale: boolean;
}

export interface GenerateResult {
  content: string;
  schema: AirtableBaseSchema;
}