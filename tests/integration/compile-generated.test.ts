import { describe, it, beforeAll, expect, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { mockAirtableSchema } from '../fixtures/mock-schema';

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

  beforeAll(async () => {
    await fs.rm(genDir, { recursive: true, force: true });
    await fs.mkdir(genDir, { recursive: true });
  });

  it('single-file TypeScript (no flatten)', async () => {
    const { generateTypes } = await import('../../src/generator/types.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const { content } = await generateTypes({ baseId: 'appTest123', token: 'x', flatten: false });
    await fs.writeFile(path.join(genDir, 'types.ts'), content, 'utf8');

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);
  });

  it('single-file TypeScript (flatten)', async () => {
    const { generateTypes } = await import('../../src/generator/types.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const { content } = await generateTypes({ baseId: 'appTest123', token: 'x', flatten: true });
    await fs.writeFile(path.join(genDir, 'types-flat.ts'), content, 'utf8');

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);
  });

  it('single-file Zod (no flatten)', async () => {
    const { fetchBaseSchema } = await import('../../src/generator/schema.js');
    const { generateTableZodSchema, generateUtilityZodTypes } =
      await import('../../src/generator/zod-generator.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const schema = await fetchBaseSchema('appTest123', 'x');
    const imports = "import { z } from 'zod';\n\n";
    const schemas = schema.tables
      .map((t: any) => generateTableZodSchema(t, false, { includeImport: false }))
      .join('\n\n');
    const utils = generateUtilityZodTypes(schema, { flatten: false });
    await fs.writeFile(path.join(genDir, 'zod-schemas.ts'), imports + schemas + utils, 'utf8');

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);

    // Sanity check: inferred type uses Readonly<z.infer<...>> and readonly fields are marked
    const content = await fs.readFile(path.join(genDir, 'zod-schemas.ts'), 'utf8');
    expect(content).toMatch(/export type \w+Record = z\.infer/);
    expect(content).toContain('.readonly()');
  });

  it('single-file Zod (flatten)', async () => {
    const { fetchBaseSchema } = await import('../../src/generator/schema.js');
    const { generateTableZodSchema, generateUtilityZodTypes } =
      await import('../../src/generator/zod-generator.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const schema = await fetchBaseSchema('appTest123', 'x');
    const imports = "import { z } from 'zod';\n\n";
    const schemas = schema.tables
      .map((t: any) => generateTableZodSchema(t, true, { includeImport: false }))
      .join('\n\n');
    const utils = generateUtilityZodTypes(schema, { flatten: true });
    await fs.writeFile(path.join(genDir, 'zod-schemas-flat.ts'), imports + schemas + utils, 'utf8');

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);

    const content = await fs.readFile(path.join(genDir, 'zod-schemas-flat.ts'), 'utf8');
    // Should re-export flattenRecord and include creation/update helpers
    expect(content).toContain("export { flattenRecord } from 'airtable-types-gen/runtime'");
    expect(content).toMatch(/ReadonlyFields|CreationSchema|UpdateSchema/);
  });

  it('multi-file TypeScript (no flatten)', async () => {
    const { generateMultipleFiles } = await import('../../src/generator/multi-file.js');
    const { fetchBaseSchema } = await import('../../src/generator/schema.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const schema = await fetchBaseSchema('appTest123', 'x');
    const outDir = path.join(genDir, 'types');
    await fs.mkdir(outDir, { recursive: true });
    const { files } = await generateMultipleFiles(schema, outDir, {
      format: 'typescript',
      flatten: false,
    });
    await Promise.all(
      Object.entries(files).map(([n, c]) => fs.writeFile(path.join(outDir, n), c as string, 'utf8'))
    );

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);
  });

  it('multi-file TypeScript (flatten)', async () => {
    const { generateMultipleFiles } = await import('../../src/generator/multi-file.js');
    const { fetchBaseSchema } = await import('../../src/generator/schema.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const schema = await fetchBaseSchema('appTest123', 'x');
    const outDir = path.join(genDir, 'types-flat');
    await fs.mkdir(outDir, { recursive: true });
    const { files } = await generateMultipleFiles(schema, outDir, {
      format: 'typescript',
      flatten: true,
    });
    await Promise.all(
      Object.entries(files).map(([n, c]) => fs.writeFile(path.join(outDir, n), c as string, 'utf8'))
    );

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);
  });

  it('multi-file Zod (flatten)', async () => {
    const { generateMultipleFiles } = await import('../../src/generator/multi-file.js');
    const { fetchBaseSchema } = await import('../../src/generator/schema.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const schema = await fetchBaseSchema('appTest123', 'x');
    const outDir = path.join(genDir, 'schemas-flat');
    await fs.mkdir(outDir, { recursive: true });
    const { files } = await generateMultipleFiles(schema, outDir, { format: 'zod', flatten: true });
    await Promise.all(
      Object.entries(files).map(([n, c]) => fs.writeFile(path.join(outDir, n), c as string, 'utf8'))
    );

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);

    const indexContent = await fs.readFile(path.join(outDir, 'index.ts'), 'utf8');
    // Index should import z for z.infer usage
    expect(indexContent).toContain("import { z } from 'zod'");
    // And expose creation/update helpers
    expect(indexContent).toMatch(/CreationSchema|UpdateSchema/);
  });

  it('multi-file Zod (no flatten)', async () => {
    const { generateMultipleFiles } = await import('../../src/generator/multi-file.js');
    const { fetchBaseSchema } = await import('../../src/generator/schema.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const schema = await fetchBaseSchema('appTest123', 'x');
    const outDir = path.join(genDir, 'schemas');
    await fs.mkdir(outDir, { recursive: true });
    const { files } = await generateMultipleFiles(schema, outDir, {
      format: 'zod',
      flatten: false,
    });
    await Promise.all(
      Object.entries(files).map(([n, c]) => fs.writeFile(path.join(outDir, n), c as string, 'utf8'))
    );

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);

    const indexContent = await fs.readFile(path.join(outDir, 'index.ts'), 'utf8');
    // Index should import z for z.infer usage
    expect(indexContent).toContain("import { z } from 'zod'");
  });

  it('single-file TS with table filter and compiles', async () => {
    const { generateTypes } = await import('../../src/generator/types.js');
    const viAny: any = vi;
    viAny.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const { content } = await generateTypes({
      baseId: 'appTest123',
      token: 'x',
      tables: ['Users'],
      flatten: false,
    });
    await fs.writeFile(path.join(genDir, 'types-users-only.ts'), content, 'utf8');

    const tsc = await runTsc();
    expect(tsc.code).toBe(0);
  });
});
