import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTypes } from '../../src/generator/types';
import { mockAirtableSchema } from '../fixtures/mock-schema';

// Mock the fetch function
global.fetch = vi.fn();

describe('generateTypes integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate TypeScript types without flatten', async () => {
    // Mock the API response
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAirtableSchema,
    });

    const result = await generateTypes({
      baseId: 'appTest123',
      token: 'test-token',
      flatten: false,
    });

    expect(result.content).toContain('export interface UsersRecord');
    expect(result.content).toContain('export interface ProjectsRecord');
    // Every field is optional: Airtable omits empty cells, so raw payloads
    // guarantee nothing. See tests/unit/emitter-alignment.test.ts.
    expect(result.content).toContain('Created?: string;');
    expect(result.content).toContain('["Auto ID"]?: number;');
    expect(result.content).toContain('"Admin" | "User" | "Guest"');
    expect(result.content).toContain('Array<"Planning" | "In Progress" | "Completed">');
    expect(result.schema).toEqual(mockAirtableSchema);
  });

  it('should generate TypeScript types with flatten support', async () => {
    // Mock the API response
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAirtableSchema,
    });

    const result = await generateTypes({
      baseId: 'appTest123',
      token: 'test-token',
      flatten: true,
    });

    expect(result.content).toContain('export interface UsersRecord');
    expect(result.content).toContain('export interface ProjectsRecord');
    expect(result.content).toContain('export interface FlattenedRecord');
    expect(result.content).toContain('export { flattenRecord }');
    expect(result.content).toContain('export const AIRTABLE_TABLE_NAMES');
    expect(result.content).toContain('AIRTABLE_TABLE_NAMES = ["Users", "Projects"] as const;');
    expect(result.schema).toEqual(mockAirtableSchema);
  });

  it('should not contain literal \\n escape sequences in output', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAirtableSchema,
    });

    const result = await generateTypes({
      baseId: 'appTest123',
      token: 'test-token',
      flatten: false,
    });

    // Heuristic: there should be no ";\n" artifacts with literal backslash n after semicolons
    expect(result.content).not.toContain(';\\n');
    // Ensure real newline separation between interfaces
    expect(result.content).toMatch(/interface UsersRecord[\s\S]*interface ProjectsRecord/);
  });

  it('should filter tables when specified', async () => {
    // Mock the API response
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAirtableSchema,
    });

    const result = await generateTypes({
      baseId: 'appTest123',
      token: 'test-token',
      tables: ['Users'],
      flatten: false,
    });

    expect(result.content).toContain('export interface UsersRecord');
    expect(result.content).not.toContain('export interface ProjectsRecord');
    expect(result.schema.tables).toHaveLength(1);
    expect(result.schema.tables[0].name).toBe('Users');
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(
      generateTypes({
        baseId: 'appTest123',
        token: 'invalid-token',
      })
    ).rejects.toThrow('HTTP error! status: 401');
  });

  it('should handle network errors', async () => {
    // Mock network error
    (fetch as any).mockRejectedValueOnce(new Error('Network error'));

    await expect(
      generateTypes({
        baseId: 'appTest123',
        token: 'test-token',
      })
    ).rejects.toThrow('Network error');
  });

  it('should generate utility types correctly', async () => {
    // Mock the API response
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAirtableSchema,
    });

    const result = await generateTypes({
      baseId: 'appTest123',
      token: 'test-token',
      flatten: false,
    });

    // Check utility types
    expect(result.content).toContain('export type AirtableTableName');
    expect(result.content).toContain('export const AIRTABLE_TABLE_NAMES');
    expect(result.content).toContain('export interface AirtableTableTypes');
    expect(result.content).toContain('export type GetTableRecord<T extends AirtableTableName>');
    expect(result.content).toContain('export type CreateRecord<T extends AirtableTableName>');
    expect(result.content).toContain('export type UpdateRecord<T extends AirtableTableName>');
    expect(result.content).toContain('export type ReadRecord<T extends AirtableTableName>');

    // Check table name union
    expect(result.content).toContain('"Users" | "Projects"');

    // Check table names array runtime constant
    expect(result.content).toContain('AIRTABLE_TABLE_NAMES = ["Users", "Projects"] as const;');

    // Check table mapping
    expect(result.content).toContain('"Users": UsersRecord;');
    expect(result.content).toContain('"Projects": ProjectsRecord;');
  });
});
