const fs = require('fs');
const path = require('path');
const nock = require('nock');

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../fixtures/youtube-channel.json'), 'utf8'),
);

nock.disableNetConnect();
nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'));

function registerMocks(baseUrl) {
  const scope = nock(baseUrl).persist();

  scope.get('/youtube/v3/channels').query((query) => query.part === 'snippet').reply(200, {
    items: [
      {
        id: fixture.channelId,
        snippet: {
          title: fixture.channelTitle,
          thumbnails: {
            high: { url: fixture.thumbnailUrl },
          },
        },
      },
    ],
  });

  scope
    .get('/youtube/v3/channels')
    .query((query) => query.part === 'contentDetails')
    .reply(200, {
      items: [
        {
          id: fixture.channelId,
          contentDetails: {
            relatedPlaylists: {
              uploads: fixture.uploadsPlaylistId,
            },
          },
        },
      ],
    });

  scope.get('/youtube/v3/playlistItems').query(true).reply(200, {
    items: fixture.videos.map((video) => ({
      snippet: {
        title: video.title,
        publishedAt: video.publishedAt,
        resourceId: {
          videoId: video.videoId,
        },
      },
    })),
  });
}

registerMocks('https://youtube.googleapis.com');
registerMocks('https://www.googleapis.com');
