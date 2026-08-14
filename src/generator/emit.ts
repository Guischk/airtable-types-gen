/**
 * Shared helpers for turning Airtable metadata into TypeScript/Zod source text.
 *
 * Everything user-controlled — table names, field names, descriptions, select
 * choices — reaches the generated file through one of these. Keeping the
 * escaping in a single place is what stops a stray quote, backslash or comment
 * terminator from producing a module that will not parse.
 */

/**
 * Make an arbitrary string safe to drop inside a JSDoc block.
 *
 * Collapses newlines onto one line and breaks up any comment terminator: a
 * description containing one would otherwise close the comment early and spill
 * the rest of the line into the file as code.
 */
export const sanitizeComment = (text: string): string =>
  text
    .replace(/\\r|\\n/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\*\//g, '* /')
    .trim();

/**
 * Render an object property key, quoting it only when it is not a plain
 * identifier. `JSON.stringify` handles quotes, backslashes and control
 * characters, which the hand-rolled `replace(/"/g, '\\"')` did not.
 */
export const propertyKey = (name: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);

/**
 * Render an interface member key, bracketing exotic names the way the
 * TypeScript generator does.
 */
export const bracketedKey = (name: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : `[${JSON.stringify(name)}]`;

/** A string literal usable in generated source. */
export const literal = (value: string): string => JSON.stringify(value);

/**
 * Join a field description and its type-derived description into a single
 * JSDoc line, or return undefined when there is nothing to say.
 */
export const describe = (...parts: (string | undefined)[]): string | undefined => {
  const cleaned = parts.filter((p): p is string => Boolean(p)).map(sanitizeComment);
  return cleaned.length > 0 ? cleaned.join(' - ') : undefined;
};
