# TASK-22 — Rotate a linked file (fix orientation)

- **Status:** [ ] not started
- **Priority:** low
- **Related:** file editor drawer (`apps/web/src/components/FileEditorCard.tsx`),
  `apps/server/src/services/file-probe.service.ts`

## Context

The file editor drawer (shipped alongside this task) shows a file's measured orientation
(`files.width`/`files.height`, probed via `ffprobe` — see `file-probe.service.ts`) but has no way
to fix a wrongly-oriented file. Rotating the file itself would be the first **mutating** ffmpeg
operation in the codebase — `fluent-ffmpeg` is currently only used read-only, to probe dimensions
and extract preview frames (`file-thumbnail.service.ts`). That raises real risks a display-only
feature doesn't have: corrupting/losing the source file, and rotation-tag semantics that vary
across containers/players.

## Scope

1. **Lossless rotation**: `ffmpeg -i <src> -c copy -metadata:s:v:0 rotate=<deg> <tmp>`, i.e. a
   stream-copy re-tag, not a re-encode — fast, no quality loss. Write to a temp file, then swap it
   into place only after ffmpeg succeeds (same "never touch the original until the replacement is
   confirmed good" discipline as `video.service.ts::renameFiles`'s claimed-destination handling).
2. **Absolute vs. cumulative rotation**: setting `rotate=<deg>` replaces any existing rotation tag
   rather than stacking. Read the file's current rotation (needs a small extension to
   `file-probe.service.ts`'s `probeDimensions`, or a new probe call, to surface the stream's
   existing `rotate`/`displaymatrix` tag) before writing the new absolute value, so repeated
   "rotate 90°" clicks actually cycle 90 → 180 → 270 → 0 instead of resetting each time.
3. **Keep `files.width`/`height` accurate**: a 90°/270° rotation swaps the _visual_ orientation
   without changing the encoded stream's raw width/height — swap the stored `width`/`height` on an
   odd multiple of 90° so the existing `orientation` template token (`video.service.ts` /
   `videoContext.ts`, PR #197) stays correct without needing to read rotation tags there too. (An
   alternative — teaching `probeDimensions`/`buildVideoContext` to read the rotate tag directly —
   is more correct long-term but touches more call sites; decide which approach before starting.)
4. **Player/container compatibility**: the `rotate` metadata tag is well-supported by MP4/H.264 in
   most modern players, but not universally (especially older tools, some `.avi`/`.mkv` handling).
   Document this as a known limitation rather than silently assuming it always works.

## Steps (not started)

- [ ] Extend `file-probe.service.ts` (or a new probe call) to read a stream's current rotation tag.
- [ ] `POST /api/files/:id/rotate` (body: `{ degrees: 90 | -90 | 180 }`) → `FileService.rotate` —
      lossless `-c copy` rotate via temp file + atomic swap, absolute-rotation computed from the
      current tag, `files.width`/`height` swapped on odd 90° steps.
- [ ] Frontend: rotate buttons in `FileEditorCard.tsx` (90° CW / CCW), calling the new endpoint and
      refetching file details + thumbnails afterward (thumbnails need regenerating post-rotate).
- [ ] Tests mocking the ffmpeg command-runner (never invoke real ffmpeg), covering: successful
      rotate, cumulative rotation across repeated calls, ffmpeg failure leaves the original file
      untouched.

## Acceptance

- Rotating a file changes its visual orientation in common players without a full re-encode.
- Repeated rotations compose correctly (90° four times returns to the original orientation).
- A failed rotate never corrupts or loses the source file.
- `files.width`/`height` (and therefore `{{video.orientation}}`) reflect the rotated orientation.
