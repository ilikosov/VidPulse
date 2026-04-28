const fs = require('fs');
const path = require('path');
const nock = require('nock');

const fixturePath = process.env.YOUTUBE_FIXTURE_PATH
  ? path.resolve(process.cwd(), process.env.YOUTUBE_FIXTURE_PATH)
  : path.resolve(__dirname, '../fixtures/youtube-channel-fixture.json');

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

nock.disableNetConnect();
nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'));

function buildVideosListResponse(query) {
  const rawIds = Array.isArray(query.id) ? query.id.join(',') : String(query.id || '');
  const ids = rawIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    items: ids
      .map((id) => fixture.videosList[id])
      .filter(Boolean),
  };
}

function registerMocks(baseUrl) {
  const scope = nock(baseUrl).persist();

  scope.get('/youtube/v3/channels').query((query) => {
    if (query.forUsername) {
      return true;
    }

    if (query.id === fixture.channelId || (Array.isArray(query.id) && query.id.includes(fixture.channelId))) {
      return true;
    }

    return query.part === 'snippet' || query.part === 'contentDetails';
  }).reply(200, (_uri, reqBody, cb) => cb(null, fixture.channelsList));

  scope
    .get('/youtube/v3/playlistItems')
    .query(true)
    .reply(200, fixture.playlistItemsList);

  scope
    .get('/youtube/v3/videos')
    .query(true)
    .reply(200, (uri) => {
      const query = Object.fromEntries(new URL(`${baseUrl}${uri}`).searchParams.entries());
      return buildVideosListResponse(query);
    });
}

registerMocks('https://youtube.googleapis.com');
registerMocks('https://www.googleapis.com');
