// Main library exports
export * from './runtime/index.js';
export * from './types.js';

// Generator exports (for advanced usage)
export {
  fetchBaseSchema,
  generateFromSchema,
  generateTypes,
  // 0.7.0 made a non-matching `tables` selection throw, as a breaking change.
  // The class has to be reachable from the package root or callers can only
  // match on the message string, which is not a contract.
  NoMatchingTablesError,
} from './generator/index.js';
export type {
  GenerateFromSchemaOptions,
  GeneratedOutput,
  SeparateFilesOutput,
  SingleFileOutput,
} from './generator/generate.js';
