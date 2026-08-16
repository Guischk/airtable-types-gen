import { describe, it, beforeAll, expect, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { mockAirtableSchema } from '../fixtures/mock-schema';
import type { OutputFormat } from '../../src/types.js';

// Run TypeScript type-check in test-local against generated outputs
const runTsc = async () => {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn('npx', ['tsc', '--noEmit', '-p', 'test-local/tsconfig.json'], {
      cwd: path.resolve(process.cwd()),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
};

describe('Generated files compile in test-local for key option combinations', () => {
  const root = path.resolve(process.cwd());
  const testLocal = path.join(root, 'test-local');
  const genDir = path.join(testLocal, 'generated');

  const fetchMockSchema = async () => {
    const { fetchBaseSchema } = await import('../../src/generator/schema.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));
    return fetchBaseSchema('appTest123', 'x');
  };

  /**
   * Both helpers go through `generateFromSchema`, the same seam the CLI crosses.
   * They used to re-assemble the Zod output by hand — which meant this suite
   * could pass while the CLI emitted something else.
   */
  const generateSingle = async (options: {
    format: OutputFormat;
    flatten?: boolean;
    tables?: string[];
  }): Promise<string> => {
    const { generateFromSchema } = await import('../../src/generator/generate.js');
    const schema = await fetchMockSchema();
    return generateFromSchema({ schema, ...options, layout: 'single' }).content;
  };

  const generateSeparate = async (options: {
    format: OutputFormat;
    flatten?: boolean;
  }): Promise<Record<string, string>> => {
    const { generateFromSchema } = await import('../../src/generator/generate.js');
    const schema = await fetchMockSchema();
    return generateFromSchema({ schema, ...options, layout: 'separate' }).files;
  };

  const writeAll = async (outDir: string, files: Record<string, string>) => {
    await fs.mkdir(outDir, { recursive: true });
    await Promise.all(
      Object.entries(files).map(([name, content]) =>
        fs.writeFile(path.join(outDir, name), content, 'utf8')
      )
    );
  };

  beforeAll(async () => {
    await fs.rm(genDir, { recursive: true, force: true });
    await fs.mkdir(genDir, { recursive: true });
  });

  it('single-file TypeScript (no flatten), through the published generateTypes', async () => {
    const { generateTypes } = await import('../../src/generator/generate.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const { content } = await generateTypes({ baseId: 'appTest123', token: 'x', flatten: false });
    await fs.writeFile(path.join(genDir, 'types.ts'), content, 'utf8');

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);
  });

  it('single-file TypeScript (flatten)', async () => {
    const content = await generateSingle({ format: 'typescript', flatten: true });
    await fs.writeFile(path.join(genDir, 'types-flat.ts'), content, 'utf8');

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);
  });

  it('single-file Zod (no flatten)', async () => {
    const content = await generateSingle({ format: 'zod', flatten: false });
    await fs.writeFile(path.join(genDir, 'zod-schemas.ts'), content, 'utf8');

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);

    // Sanity check: inferred type uses z.infer<...> and readonly fields are marked
    expect(content).toMatch(/export type \w+Record = z\.infer/);
    expect(content).toContain('.readonly()');
    expect(content.startsWith("import { z } from 'zod';")).toBe(true);
  });

  it('single-file Zod (flatten)', async () => {
    const content = await generateSingle({ format: 'zod', flatten: true });
    await fs.writeFile(path.join(genDir, 'zod-schemas-flat.ts'), content, 'utf8');

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);

    // Should re-export flattenRecord and include creation/update helpers
    expect(content).toContain("export { flattenRecord } from 'airtable-types-gen/runtime'");
    expect(content).toMatch(/ReadonlyFields|CreationSchema|UpdateSchema/);
  });

  /**
   * The 0.6.0 regression, reproduced at the type level.
   *
   * `.default('')` makes a field required in `z.infer<>` — correct for the read
   * path, fatal for a write derived from it: `createUser({ email, firstname })`
   * came back with "Property 'record_id' is missing … and 35 more". The
   * generated creation schema is the answer, and native mode did not have one.
   */
  it('a create payload type-checks from the generated creation schema (native)', async () => {
    const outDir = path.join(genDir, 'native-writes');
    const content = await generateSingle({ format: 'zod', flatten: false });

    await writeAll(outDir, {
      'schemas.ts': content,
      'consumer.ts': [
        "import { type UsersCreation, type UsersRecord, UsersCreationSchema } from './schemas';",
        "import type { CreatePayload, WritableOnly } from 'airtable-types-gen/runtime';",
        '',
        '// A create carrying a couple of fields, which is the whole point.',
        "export const create: UsersCreation = { fields: { Name: 'Ada' } };",
        '',
        '// Same claim at runtime.',
        "export const parsed = UsersCreationSchema.parse({ fields: { Name: 'Ada' } });",
        '',
        '// And the read path stays guaranteed: no guard on a restored field.',
        'export const readName = (record: UsersRecord): string => record.fields.Name;',
        '',
        '// CreatePayload<T>, for a hand-written interface: drops readonly',
        '// properties and makes every remaining one optional.',
        'interface ManualRecord {',
        '  readonly id: string;',
        '  name: string;',
        '  note: string;',
        '}',
        "export const manual: CreatePayload<ManualRecord> = { name: 'Ada' };",
        'export const blank: CreatePayload<ManualRecord> = {};',
        '// @ts-expect-error `id` is readonly, so a create payload has no such key.',
        "export const withId: CreatePayload<ManualRecord> = { id: 'rec1' };",
        '',
        '// The contrast that motivated the deprecation: WritableOnly keeps every',
        '// non-readonly property *required*, which is why it is not a create type.',
        '// @ts-expect-error `note` is missing — WritableOnly makes nothing optional.',
        "export const viaWritableOnly: WritableOnly<ManualRecord> = { name: 'Ada' };",
        '',
      ].join('\n'),
    });

    const tsc = await runTsc();
    expect(tsc.code, tsc.stdout).toBe(0);

    // Nothing on the write path may carry a default, in either structure.
    for (const source of [content, await generateSingle({ format: 'zod', flatten: true })]) {
      expect(source).toContain('export const UsersWritableSchema = z.object({');
      const block = source.slice(source.indexOf('export const UsersWritableSchema'));
      expect(block.slice(0, block.indexOf('CreationSchema'))).not.toContain('.default(');
    }
  });

  it('multi-file TypeScript (no flatten)', async () => {
    const files = await generateSeparate({ format: 'typescript', flatten: false });
    await writeAll(path.join(genDir, 'types'), files);

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);

    // The index carries the same utility block the single-file run emits, not a
    // hand-written subset of it.
    expect(files['index.ts']).toContain('export type CreateRecord<T extends AirtableTableName>');
    expect(files['index.ts']).toContain('export type UpdateRecord<T extends AirtableTableName>');
    expect(files['index.ts']).toContain('export type ReadRecord<T extends AirtableTableName>');
    expect(files['index.ts']).toContain('export interface AirtableSelectOptions');
  });

  it('multi-file TypeScript (flatten)', async () => {
    const files = await generateSeparate({ format: 'typescript', flatten: true });
    await writeAll(path.join(genDir, 'types-flat'), files);

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);
  });

  it('multi-file Zod (flatten)', async () => {
    const files = await generateSeparate({ format: 'zod', flatten: true });
    await writeAll(path.join(genDir, 'schemas-flat'), files);

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);

    // Index should import z for z.infer usage, and expose creation/update helpers
    expect(files['index.ts']).toContain("import { z } from 'zod'");
    expect(files['index.ts']).toMatch(/CreationSchema|UpdateSchema/);
  });

  it('multi-file Zod (no flatten)', async () => {
    const files = await generateSeparate({ format: 'zod', flatten: false });
    await writeAll(path.join(genDir, 'schemas'), files);

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);

    // Index should import z for z.infer usage
    expect(files['index.ts']).toContain("import { z } from 'zod'");
  });

  it('single-file TS with table filter and compiles', async () => {
    const content = await generateSingle({
      format: 'typescript',
      flatten: false,
      tables: ['Users'],
    });
    await fs.writeFile(path.join(genDir, 'types-users-only.ts'), content, 'utf8');

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);

    expect(content).toContain('export interface UsersRecord');
    expect(content).not.toContain('export interface ProjectsRecord');
  });
});
