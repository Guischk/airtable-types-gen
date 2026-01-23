import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
  generateTableFileName,
  generateSingleTableFile,
  generateIndexFile,
  generateMultipleFiles,
  writeMultipleFiles,
} from '../../src/generator/multi-file.js';
import { mockSchema, mockTable } from '../fixtures/mock-schema.js';

describe('Multi-File Generator', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(tmpdir(), `airtable-types-gen-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateTableFileName', () => {
    it('should convert table names to kebab-case filenames', () => {
      expect(generateTableFileName('Users')).toBe('users');
      expect(generateTableFileName('User Profiles')).toBe('user-profiles');
      expect(generateTableFileName('Project_Tasks')).toBe('project-tasks');
      expect(generateTableFileName('My-Special-Table')).toBe('my-special-table');
    });

    it('should handle special characters', () => {
      expect(generateTableFileName('Users & Profiles!')).toBe('users-profiles');
      expect(generateTableFileName('Table (with parentheses)')).toBe('table-with-parentheses');
      expect(generateTableFileName('2023 Reports')).toBe('2023-reports');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(generateTableFileName('-Users-')).toBe('users');
      expect(generateTableFileName('__Table__')).toBe('table');
    });
  });

  describe('generateSingleTableFile', () => {
    it('should generate TypeScript interface for a single table', () => {
      const result = generateSingleTableFile(mockTable, { format: 'typescript', flatten: false });

      expect(result).toContain('export interface UsersRecord');
      expect(result).toContain('interface UsersRecordFields');
      expect(result).toContain('id: string');
      expect(result).toContain('fields: UsersRecordFields');
      expect(result).toContain('createdTime: string');
    });

    it('should generate flattened TypeScript interface', () => {
      const result = generateSingleTableFile(mockTable, { format: 'typescript', flatten: true });

      expect(result).toContain('export interface UsersRecord');
      expect(result).toContain('record_id: string');
      expect(result).toContain('Name:');
      expect(result).toContain('Email:');
    });

    it('should generate Zod schema for a single table', () => {
      const result = generateSingleTableFile(mockTable, { format: 'zod', flatten: false });

      expect(result).toContain("import { z } from 'zod'");
      expect(result).toContain('export const UsersSchema =');
      expect(result).toContain('export type UsersRecord =');
      expect(result).toContain('z.infer<typeof UsersSchema>');
    });

    it('should generate flattened Zod schema', () => {
      const result = generateSingleTableFile(mockTable, { format: 'zod', flatten: true });

      expect(result).toContain('record_id: z.string()');
      expect(result).toContain('Name: z.string()');
    });
  });

  describe('generateIndexFile', () => {
    it('should generate TypeScript index file', () => {
      const result = generateIndexFile(mockSchema, { format: 'typescript', flatten: false });

      expect(result).toContain('// Auto-generated index file');
      expect(result).toContain('export type { UsersRecord }');
      expect(result).toContain("export type AirtableTableName = 'Users'");
      expect(result).toContain('export interface AirtableTableTypes');
      expect(result).toContain('export type GetTableRecord<T extends AirtableTableName>');
    });

    it('should generate Zod index file', () => {
      const result = generateIndexFile(mockSchema, { format: 'zod', flatten: false });

      expect(result).toContain('// Auto-generated index file');
      expect(result).toContain('export { UsersSchema, type UsersRecord }');
      expect(result).toContain('export type AirtableTableName = "Users"');
      expect(result).toContain('export interface AirtableTableSchemas');
      expect(result).toContain('export type GetTableSchema<T extends AirtableTableName>');
      expect(result).toContain('export type GetTableType<T extends AirtableTableName>');
      expect(result).toContain('export const validateRecord =');
    });

    it('should handle multiple tables', () => {
      const multiTableSchema = {
        tables: [
          mockTable,
          {
            ...mockTable,
            id: 'tblSecond',
            name: 'Projects',
            fields: mockTable.fields,
          },
        ],
      };

      const result = generateIndexFile(multiTableSchema, { format: 'typescript', flatten: false });

      expect(result).toContain("export type AirtableTableName = 'Users' | 'Projects'");
      expect(result).toContain('export type { UsersRecord }');
      expect(result).toContain('export type { ProjectsRecord }');
    });
  });

  describe('generateMultipleFiles', () => {
    it('should generate multiple files for TypeScript', async () => {
      const singleTableSchema = { tables: [mockTable] };
      const result = await generateMultipleFiles(singleTableSchema, tempDir, {
        format: 'typescript',
        flatten: false,
      });

      expect(result.files).toHaveProperty('users.ts');
      expect(result.files).toHaveProperty('index.ts');
      expect(Object.keys(result.files)).toHaveLength(2);

      expect(result.files['users.ts']).toContain('export interface UsersRecord');
      expect(result.files['index.ts']).toContain('export type { UsersRecord }');
      expect(result.indexContent).toContain('export type { UsersRecord }');
    });

    it('should generate multiple files for Zod', async () => {
      const singleTableSchema = { tables: [mockTable] };
      const result = await generateMultipleFiles(singleTableSchema, tempDir, {
        format: 'zod',
        flatten: false,
      });

      expect(result.files).toHaveProperty('users.ts');
      expect(result.files).toHaveProperty('index.ts');
      expect(Object.keys(result.files)).toHaveLength(2);

  expect(result.files['users.ts']).toContain('export const UsersSchema =');
  expect(result.files['users.ts']).toContain('export type UsersRecord =');
  expect(result.files['index.ts']).toContain('export { UsersSchema, type UsersRecord }');
    });

    it('should handle multiple tables correctly', async () => {
      const multiTableSchema = {
        tables: [
          mockTable,
          {
            ...mockTable,
            id: 'tblProjects',
            name: 'Project Tasks',
            fields: mockTable.fields,
          },
        ],
      };

      const result = await generateMultipleFiles(multiTableSchema, tempDir, {
        format: 'typescript',
        flatten: false,
      });

      expect(result.files).toHaveProperty('users.ts');
      expect(result.files).toHaveProperty('project-tasks.ts');
      expect(result.files).toHaveProperty('index.ts');
      expect(Object.keys(result.files)).toHaveLength(3);

      expect(result.files['project-tasks.ts']).toContain('ProjectTasksRecord');
    });

    it('should generate multiple files for TypeScript with flatten', async () => {
      const singleTableSchema = { tables: [mockTable] };
      const result = await generateMultipleFiles(singleTableSchema, tempDir, {
        format: 'typescript',
        flatten: true,
      });

      expect(result.files['users.ts']).toContain('export interface UsersRecord');
      expect(result.files['users.ts']).toContain('record_id: string');
      expect(result.files['index.ts']).toContain('export type AirtableTableName =');
    });

    it('should generate multiple files for Zod with flatten', async () => {
      const singleTableSchema = { tables: [mockTable] };
      const result = await generateMultipleFiles(singleTableSchema, tempDir, {
        format: 'zod',
        flatten: true,
      });

      expect(result.files['users.ts']).toContain('export const UsersSchema =');
      expect(result.files['users.ts']).toContain('record_id: z.string()');
      expect(result.files['index.ts']).toContain('export { UsersSchema, type UsersRecord }');
    });
  });

  describe('writeMultipleFiles', () => {
    it('should write files to filesystem', async () => {
      const files = {
        'users.ts': 'export interface UsersRecord {}',
        'index.ts': 'export * from "./users.js";',
        'projects.ts': 'export interface ProjectsRecord {}',
      };

      await writeMultipleFiles(tempDir, files);

      // Check that files were created
      const userFile = await fs.readFile(path.join(tempDir, 'users.ts'), 'utf8');
      const indexFile = await fs.readFile(path.join(tempDir, 'index.ts'), 'utf8');
      const projectFile = await fs.readFile(path.join(tempDir, 'projects.ts'), 'utf8');

      expect(userFile).toBe('export interface UsersRecord {}');
      expect(indexFile).toBe('export * from "./users.js";');
      expect(projectFile).toBe('export interface ProjectsRecord {}');
    });

    it('should create directory if it does not exist', async () => {
      const nestedDir = path.join(tempDir, 'nested', 'schemas');
      const files = {
        'test.ts': 'export const test = true;',
      };

      await writeMultipleFiles(nestedDir, files);

      const testFile = await fs.readFile(path.join(nestedDir, 'test.ts'), 'utf8');
      expect(testFile).toBe('export const test = true;');
    });

    it('should handle empty files object', async () => {
      await expect(writeMultipleFiles(tempDir, {})).resolves.not.toThrow();

      // Directory should still be created
      const stat = await fs.stat(tempDir);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('Integration: Full multi-file generation', () => {
    it('should generate and write complete multi-file structure', async () => {
      const singleTableSchema = { tables: [mockTable] };
      const result = await generateMultipleFiles(singleTableSchema, tempDir, {
        format: 'zod',
        flatten: true,
      });

      await writeMultipleFiles(tempDir, result.files);

      // Verify files exist
      const files = await fs.readdir(tempDir);
      expect(files).toContain('users.ts');
      expect(files).toContain('index.ts');

      // Verify content
      const userContent = await fs.readFile(path.join(tempDir, 'users.ts'), 'utf8');
      const indexContent = await fs.readFile(path.join(tempDir, 'index.ts'), 'utf8');

      expect(userContent).toContain("import { z } from 'zod'");
      expect(userContent).toContain('export const UsersSchema =');
      expect(userContent).toContain('record_id: z.string()');

  expect(indexContent).toContain('export { UsersSchema, type UsersRecord }');
      expect(indexContent).toContain('export const validateRecord =');
    });
  });
});