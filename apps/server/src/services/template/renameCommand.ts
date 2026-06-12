import path from 'path';
import { renderTemplate, type EntityContext } from './template.engine';

/** A physical file linked to a video — the source of a rename. */
export interface RenameSource {
  directory: string;
  filename: string;
  extension: string | null;
}

/** A video with its template context and any linked files on disk. */
export interface RenameItem {
  context: EntityContext;
  files: RenameSource[];
}

/** Wrap a path in double quotes, escaping embedded double quotes for the shell. */
function shellQuote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/**
 * Build one `mv "<source>" "<dest>"` line per linked file. The template renders only the new
 * base name (the source extension is preserved); `/` in the rendered name is replaced with `-`
 * so it can't escape the directory. Videos without a linked file are skipped.
 */
export function buildRenameCommands(template: string, items: RenameItem[]): string {
  const lines: string[] = [];
  for (const { context, files } of items) {
    const baseName = renderTemplate(template, { video: [context] })
      .replace(/\//g, '-')
      .trim();
    for (const file of files) {
      const newName = baseName + (file.extension ?? '');
      const source = path.join(file.directory, file.filename);
      const dest = path.join(file.directory, newName);
      lines.push(`mv ${shellQuote(source)} ${shellQuote(dest)}`);
    }
  }
  return lines.join('\n');
}
