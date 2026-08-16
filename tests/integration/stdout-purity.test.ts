import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mockAirtableSchema } from '../fixtures/mock-schema';

const execFileAsync = promisify(execFile);

/**
 * The CLI is documented as `airtable-types-gen > schemas.ts`, so stdout carries
 * the generated module and nothing else. Anything chatty that reaches stdout —
 * a progress line, a dependency's banner — lands inside the user's TypeScript
 * file and stops it parsing. Both have happened, so both are guarded here.
 */
describe('stdout carries only generated output', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('generateTypes writes nothing to stdout', async () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      writes.push(String(chunk));
      return true;
    });
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => mockAirtableSchema }));

    const { generateTypes } = await import('../../src/generator/generate.js');
    await generateTypes({ baseId: 'appTest123', token: 'x', flatten: false, tables: ['Users'] });

    expect(writes.join('')).toBe('');
  });

  it('writeMultipleFiles reports progress on stderr only', async () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      writes.push(String(chunk));
      return true;
    });

    const { writeMultipleFiles } = await import('../../src/generator/multi-file.js');
    const outDir = path.join(process.cwd(), 'test-local', 'generated', 'stdout-check');
    await writeMultipleFiles(outDir, { 'a.ts': 'export const a = 1;\n' });

    expect(writes.join('')).toBe('');
  });

  const cliPath = path.join(process.cwd(), 'dist', 'cli', 'index.js');

  it.runIf(existsSync(cliPath))('the built CLI prints only the version on stdout', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, '--version']);
    // No dotenv banner, no progress lines — just the version.
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
