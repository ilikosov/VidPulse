# YouTube E2E fixture usage

This folder contains JSON fixtures used by E2E tests.

## Files

- `youtube-channel-fixture.json` - unified fixture for:
  - `channels.list`
  - `playlistItems.list`
  - `videos.list`

## Backend mock usage (current E2E setup)

The backend test server loads `tests/e2e/setup/youtube-mock.cjs`, which reads
`youtube-channel-fixture.json` and mocks `https://www.googleapis.com/youtube/v3/*`
(and `youtube.googleapis.com`) with `nock`.

## Optional Playwright `page.route` skeleton

Use this only for tests where browser code calls YouTube APIs directly:

```ts
import fixture from '../fixtures/youtube-channel-fixture.json';

await page.route('https://www.googleapis.com/youtube/v3/channels**', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture.channelsList) });
});

await page.route('https://www.googleapis.com/youtube/v3/playlistItems**', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture.playlistItemsList) });
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
```
