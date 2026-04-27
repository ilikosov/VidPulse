import fs from 'fs/promises';
import path from 'path';
import { expect, test } from '@playwright/test';
import { e2eDb, resetDatabase } from './helpers/db';
import { ReviewPage } from './pages/ReviewPage';
import { VideosPage } from './pages/VideosPage';

const mockChannelId = 'UC1111111111111111111111';
const downloadsRoot = path.resolve(__dirname, '../../downloads');

test.beforeEach(async () => {
  await resetDatabase();
  await fs.rm(downloadsRoot, { recursive: true, force: true });
});

test.afterAll(async () => {
  await e2eDb.destroy();
});

test('adds a channel and syncs mocked videos', async ({ page, request }) => {
  const addResponse = await request.post('http://127.0.0.1:3000/api/channels', {
    data: {
      url: mockChannelId,
    },
  });
  expect(addResponse.ok()).toBeTruthy();

  const videosResponse = await request.get('http://127.0.0.1:3000/api/videos?limit=50');
  expect(videosResponse.ok()).toBeTruthy();
  const payload = await videosResponse.json();

  expect(payload.videos.length).toBeGreaterThanOrEqual(2);
  expect(payload.videos.map((video: { youtube_id: string }) => video.youtube_id)).toEqual(
    expect.arrayContaining(['vid_e2e_001', 'vid_e2e_002']),
  );

  const videosPage = new VideosPage(page);
  await videosPage.goto();
  await videosPage.expectVideoVisible('240101 IVE - Baddie @MBC');
  await videosPage.expectVideoVisible('240102 AESPA - Drama @SBS');
});

test('manual metadata editing from review queue updates status to new', async ({ page, request }) => {
  const [channelId] = await e2eDb('channels').insert({
    youtube_id: 'UC9999999999999999999999',
    title: 'Manual Review Channel',
    added_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
  });

  const [videoId] = await e2eDb('videos').insert({
    youtube_id: 'vid_review_001',
    channel_id: channelId,
    original_title: 'Unparsed test clip',
    status: 'needs_review',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const reviewPage = new ReviewPage(page);
  await reviewPage.goto();
  await reviewPage.fillAndSaveForVideo('Unparsed test clip', {
    perfDate: '240315',
    group: 'IVE',
    artist: 'WONYOUNG',
    song: 'Kitsch',
    event: 'MCOUNTDOWN',
    camera: 'FANCAM',
  });

  await expect(page.getByText('Saved: Unparsed test clip')).toBeVisible();

  const videoResponse = await request.get(`http://127.0.0.1:3000/api/videos/${videoId}`);
  const updated = await videoResponse.json();
  expect(updated.status).toBe('new');
  expect(updated.group_name).toBe('IVE');
  expect(updated.song_title).toBe('Kitsch');
  expect(updated.event).toBe('@MCOUNTDOWN');
});

test('batch confirm download marks selected videos as downloaded', async ({ page, request }) => {
  const [channelId] = await e2eDb('channels').insert({
    youtube_id: 'UC8888888888888888888888',
    title: 'Batch Channel',
    added_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
  });

  const videoRows = [
    { youtube_id: 'batch_vid_001', original_title: 'Batch Video One' },
    { youtube_id: 'batch_vid_002', original_title: 'Batch Video Two' },
  ];

  for (const row of videoRows) {
    await e2eDb('videos').insert({
      ...row,
      channel_id: channelId,
      status: 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const filePath = path.join(downloadsRoot, row.youtube_id, 'original.mp4');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, 'mock video file');
  }

  const videosPage = new VideosPage(page);
  await videosPage.goto();
  await videosPage.filterByStatus('New');
  await videosPage.selectVideoByTitle('Batch Video One');
  await videosPage.selectVideoByTitle('Batch Video Two');
  await videosPage.confirmDownloadSelected();

  await expect(page.getByText(/Confirm Download: 2\/2 succeeded/)).toBeVisible();

  const videosResponse = await request.get('http://127.0.0.1:3000/api/videos?status=downloaded&limit=50');
  const payload = await videosResponse.json();
  const downloadedTitles = payload.videos.map((video: { original_title: string }) => video.original_title);

  expect(downloadedTitles).toEqual(expect.arrayContaining(['Batch Video One', 'Batch Video Two']));
});
