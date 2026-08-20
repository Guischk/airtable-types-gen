import { describe, it, expect } from 'vitest';

// The import path is the assertion. Everything here must come from the package
// root — the module `package.json` maps to `./dist/index.js` — because that is
// the only surface a consumer can reach. `src/index.ts` re-exports a *named*
// list rather than `export *`, so a symbol can exist, be exported from
// `src/generator/`, and still be unreachable. That is how 0.7.0 shipped a
// breaking change asking callers to handle an error they could not name.
import { NoMatchingTablesError, generateFromSchema } from '../../src/index';

describe('the package root', () => {
  const schema = {
    tables: [{ id: 'tbl1', name: 'Users', primaryFieldId: 'f1', views: [], fields: [] }],
  };

  describe('NoMatchingTablesError', () => {
    it('is exported, so a caller can name the error 0.7.0 asks them to handle', () => {
      expect(NoMatchingTablesError).toBeTypeOf('function');
      expect(NoMatchingTablesError.prototype).toBeInstanceOf(Error);
    });

    it('is the same class the generator throws, so instanceof works across the boundary', () => {
      // The point of the export: catching by type rather than by message.
      // A separate class object here would satisfy `toBeTypeOf` above and
      // still fail every real caller.
      let caught: unknown;
      try {
        generateFromSchema({ schema, tables: ['Typo'] });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(NoMatchingTablesError);
    });

    it('carries the requested names, so a caller can report what did not match', () => {
      try {
        generateFromSchema({ schema, tables: ['Typo', 'AlsoTypo'] });
        expect.unreachable('generateFromSchema should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NoMatchingTablesError);
        expect((error as InstanceType<typeof NoMatchingTablesError>).requested).toEqual([
          'Typo',
          'AlsoTypo',
        ]);
      }
    });
  });
});
