/**
 * Tag operations moved to @vidpulse/db (`packages/db/src/tags.ts`) so the CLI backfill scripts in
 * @vidpulse/cli can share them without importing from apps/server. This file stays as a compat
 * re-export shim: existing server imports (`./tag.service`, `../tag.service`, …) and the route-test
 * mocks (`vi.mock('../services/tag.service')`) keep working unchanged.
 */
export {
  SHORTS_MAX_DURATION_SECONDS,
  SHORTS_TAG,
  LEGACY_SHORT_TAG,
  LONG_VIDEO_MIN_DURATION_SECONDS,
  LONG_VIDEO_TAG,
  addTagToVideo,
  assignAutoTags,
  tagShortsByDuration,
  tagLongVideosByDuration,
  mergeShortTags,
} from '@vidpulse/db';
