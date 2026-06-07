import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import { e2eDb, resetDatabase } from './helpers/db';

const fixturePath = path.resolve(__dirname, 'fixtures/youtube-channel-fixture.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
  channelUrl: string;
  playlistItemsList: { items: Array<{ snippet: { title: string } }> };
  videosList: Record<string, { snippet: { title: string } }>;
  channelsList: unknown;
};

async function routeYoutubeApi(page: Page) {
  await page.route('https://www.googleapis.com/youtube/v3/channels**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture.channelsList),
    });
  });

  await page.route('https://www.googleapis.com/youtube/v3/playlistItems**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture.playlistItemsList),
    });
  });

  await page.route('https://www.googleapis.com/youtube/v3/videos**', async (route) => {
    const url = new URL(route.request().url());
    const ids = (url.searchParams.get('id') || '').split(',').filter(Boolean);
    const items = ids.map((id) => fixture.videosList[id]).filter(Boolean);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await routeYoutubeApi(page);
});

test.afterAll(async () => {
  await e2eDb.destroy();
});

test('auto-assigns short and private tags after channel sync', async ({ page, request }) => {
  await page.goto('/channels');
  await page.getByRole('button', { name: 'Add Channel' }).click();
  await page.getByPlaceholder('https://www.youtube.com/@channelname').fill(fixture.channelUrl);
  await page.getByRole('button', { name: 'OK' }).click();

  await expect(page.getByText('Channel added successfully')).toBeVisible();

  const syncResponse = await request.post('http://127.0.0.1:3000/api/sync/trigger');
  expect(syncResponse.ok()).toBeTruthy();

  await page.goto('/videos');

  const shortPublicRow = page.locator('tbody tr', { hasText: 'Short Public Clip' });
  await expect(shortPublicRow.getByText('short', { exact: true })).toBeVisible();
  await expect(shortPublicRow.getByText('private', { exact: true })).toHaveCount(0);

  const shortPrivateRow = page.locator('tbody tr', { hasText: 'Short Private Teaser' });
  await expect(shortPrivateRow.getByText('short', { exact: true })).toBeVisible();
  await expect(shortPrivateRow.getByText('private', { exact: true })).toBeVisible();

  const longPublicRow = page.locator('tbody tr', { hasText: 'Long Public Performance' });
  await expect(longPublicRow.getByText('short', { exact: true })).toHaveCount(0);
  await expect(longPublicRow.getByText('private', { exact: true })).toHaveCount(0);
});
