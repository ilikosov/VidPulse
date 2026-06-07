import { expect, test } from '@playwright/test';
import { e2eDb, resetDatabase } from './helpers/db';

test.beforeEach(async () => {
  await resetDatabase();
});

test.afterAll(async () => {
  await e2eDb.destroy();
});

test('keeps CRUD in dictionary tabs and import/export tools in the Tools tab', async ({ page }) => {
  await page.goto('/dictionary/tools');

  await expect(page.getByRole('heading', { name: 'Media Library Tools' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import Media Library JSON' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download JSON Schema' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download Example JSON' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Export Media Library JSON' })).toBeVisible();
  await expect(page.getByText('@todo(2026-05-14)')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Groups' }).click();
  await expect(page).toHaveURL(/\/dictionary\/groups$/);
  await expect(page.getByRole('button', { name: 'Add Group' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import Media Library JSON' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Export Media Library JSON' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Tools' }).click();
  await expect(page).toHaveURL(/\/dictionary\/tools$/);
  await expect(page.getByRole('button', { name: 'Import Media Library JSON' })).toBeVisible();
});
