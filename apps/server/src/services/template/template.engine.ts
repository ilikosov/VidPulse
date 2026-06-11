/**
 * Minimal template engine for shell-command generation.
 *
 * Syntax:
 *   - Token: `{{entity.param}}` — substituted with `context[entity][param]`.
 *   - Loop:  `{{each entity}}…{{/each}}` — the body is rendered once per record in
 *            `context[entity]`, with `{{entity.param}}` inside the body resolving to the
 *            current record. This yields a single string for the whole collection
 *            (e.g. `mv "url1" "url2" /dest/`).
 *   - Array param value (e.g. `video.songs`) is joined with `, ` by default, or with a
 *            custom separator via `{{entity.param|<sep>}}`.
 *   - A missing/null/undefined value renders as an empty string.
 *
 * Outside any loop, `{{entity.param}}` resolves against the first record of that entity.
 */

export type EntityContext = Record<string, unknown>;
/** Each entity maps to an array of records (the loop iterations). */
export type TemplateContext = Record<string, EntityContext[]>;

const EACH_BLOCK = /\{\{each\s+([a-zA-Z_]\w*)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g;
const TOKEN = /\{\{\s*([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)(?:\|([^}]*))?\s*\}\}/g;

/** Build a scope that exposes the first record of every entity. */
function firstScope(context: TemplateContext): Record<string, EntityContext> {
  return Object.fromEntries(Object.keys(context).map((key) => [key, context[key][0] ?? {}]));
}

function resolveTokens(text: string, scope: Record<string, EntityContext>): string {
  return text.replace(TOKEN, (_match, entity: string, param: string, separator?: string) => {
    const value = scope[entity]?.[param];
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.map((item) => String(item)).join(separator ?? ', ');
    return String(value);
  });
}

export function renderTemplate(template: string, context: TemplateContext): string {
  // 1) Expand loops: render the body for each record of the looped entity.
  const expanded = template.replace(EACH_BLOCK, (_match, entity: string, body: string) =>
    (context[entity] ?? [])
      .map((record) => resolveTokens(body, { ...firstScope(context), [entity]: record }))
      .join(''),
  );
  // 2) Resolve any remaining tokens against the first record of each entity.
  return resolveTokens(expanded, firstScope(context));
}
