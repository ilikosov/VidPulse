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

export interface RenderOptions {
  /** Applied to every substituted value (and each array item before joining). Lets the
   * shell-command path escape YouTube-controlled values without affecting other renders. */
  transformValue?: (value: string) => string;
}

const EACH_BLOCK = /\{\{each\s+([a-zA-Z_]\w*)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g;
const TOKEN = /\{\{\s*([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)(?:\|([^}]*))?\s*\}\}/g;

/**
 * Escape a value for interpolation inside a DOUBLE-QUOTED shell argument. Neutralizes the
 * characters that terminate or expand within "..." — quote, backslash, `$`, backtick — and
 * flattens newlines (which would end the command regardless of quoting). Values substituted
 * into SHELL_COMMAND_VIDEO come from YouTube (titles, events, song names), i.e. from anyone
 * who can name a video, so without this a crafted title breaks out of the quotes and executes.
 * The template author must still wrap tokens in double quotes: `mv "{{video.title}}.mp4" …`.
 */
export function escapeShellValueForDoubleQuotes(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/[\r\n]+/g, ' ');
}

/** Build a scope that exposes the first record of every entity. */
function firstScope(context: TemplateContext): Record<string, EntityContext> {
  return Object.fromEntries(Object.keys(context).map((key) => [key, context[key][0] ?? {}]));
}

function resolveTokens(
  text: string,
  scope: Record<string, EntityContext>,
  options?: RenderOptions,
): string {
  const transform = options?.transformValue ?? ((value: string) => value);
  return text.replace(TOKEN, (_match, entity: string, param: string, separator?: string) => {
    const value = scope[entity]?.[param];
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) {
      return value.map((item) => transform(String(item))).join(separator ?? ', ');
    }
    return transform(String(value));
  });
}

export function renderTemplate(
  template: string,
  context: TemplateContext,
  options?: RenderOptions,
): string {
  // 1) Expand loops: render the body for each record of the looped entity.
  const expanded = template.replace(EACH_BLOCK, (_match, entity: string, body: string) =>
    (context[entity] ?? [])
      .map((record) => resolveTokens(body, { ...firstScope(context), [entity]: record }, options))
      .join(''),
  );
  // 2) Resolve any remaining tokens against the first record of each entity.
  return resolveTokens(expanded, firstScope(context), options);
}
