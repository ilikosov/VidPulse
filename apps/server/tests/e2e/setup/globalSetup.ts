import fs from 'fs/promises';
import path from 'path';
import knex, { type Knex } from 'knex';
import { devDbBackupPath, devDbPath, downloadsDir, repoRoot, testDbPath } from './paths';

async function pathExists(target: string) {
  try {
    await fs.lstat(target);
    return true;
  } catch {
    return false;
  }
}

async function prepareDbSymlink() {
  const devDbExists = await pathExists(devDbPath);
  if (devDbExists) {
    const stats = await fs.lstat(devDbPath);
    if (stats.isSymbolicLink()) {
      await fs.unlink(devDbPath);
    } else {
      await fs.rm(devDbBackupPath, { force: true });
      await fs.rename(devDbPath, devDbBackupPath);
    }
  }

  await fs.rm(testDbPath, { force: true });
  await fs.symlink(testDbPath, devDbPath);
}

async function migrateTestDatabase() {
  const db: Knex = knex({
    client: 'better-sqlite3',
    connection: {
      filename: testDbPath,
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(repoRoot, 'migrations'),
    },
  });

  await db.migrate.latest();
  await db.destroy();
}

export default async function globalSetup() {
  await prepareDbSymlink();
  await migrateTestDatabase();
  await fs.rm(downloadsDir, { recursive: true, force: true });
}
