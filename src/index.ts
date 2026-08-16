// Main library exports
export * from './runtime/index.js';
export * from './types.js';

// Generator exports (for advanced usage)
export { fetchBaseSchema, generateFromSchema, generateTypes } from './generator/index.js';
export type {
  GenerateFromSchemaOptions,
  GeneratedOutput,
  SeparateFilesOutput,
  SingleFileOutput,
} from './generator/generate.js';
