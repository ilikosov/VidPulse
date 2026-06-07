import path from 'path';

export const repoRoot = path.resolve(__dirname, '../../..');
export const testDbPath = path.join(repoRoot, 'dev.test.sqlite3');
export const devDbPath = path.join(repoRoot, 'src/db/dev.sqlite3');
export const devDbBackupPath = path.join(repoRoot, 'src/db/dev.sqlite3.e2e-backup');
export const downloadsDir = path.join(repoRoot, 'downloads');
