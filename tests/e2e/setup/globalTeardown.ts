import fs from 'fs/promises';
import { devDbBackupPath, devDbPath, downloadsDir, testDbPath } from './paths';

async function pathExists(target: string) {
  try {
    await fs.lstat(target);
    return true;
  } catch {
    return false;
  }
}

export default async function globalTeardown() {
  if (await pathExists(devDbPath)) {
    await fs.rm(devDbPath, { force: true });
  }

  if (await pathExists(devDbBackupPath)) {
    await fs.rename(devDbBackupPath, devDbPath);
  }

  await fs.rm(testDbPath, { force: true });
  await fs.rm(downloadsDir, { recursive: true, force: true });
}
