# Video Lists API

A video list groups videos that **share a single status**. The list's `status`
equals the status of its videos (or `null` when the list is empty). Operations on
a list are applied to **all** its videos so the list advances through the pipeline
as a unit.

## Endpoints

### Create List

**POST /api/video-lists**

- Request:
  ```json
  {
    "name": "My List",
    "videoIds": [1, 2, 3]
  }
  ```
- Response:
  - `201 Created` with list info if success
  - `409 Conflict` if video already in another list or list size limit reached

### Get All Lists

**GET /api/video-lists**

- Response: array of lists `{id, name, color, status, countVideos}`
  - `status` is the shared status of the list's videos, or `null` when empty/mixed

### Get List Details

**GET /api/video-lists/:id**

- Response: list info and videos array
- Videos include id, title, artist, group, duration, tags

### Add Video to List

**POST /api/video-lists/:id/videos**

- Request:
  ```json
  {
    "videoIds": [4, 5]
  }
  ```
- Response:
  - `200 OK` with summary
  - `409 Conflict` if any video already in another list, list limit exceeded, or the
    video's status differs from the list's status (all videos in a list must share
    one status; an empty list adopts the status of the first videos added)

### Remove Video from List

**DELETE /api/video-lists/:id/videos**

- Request:
  ```json
  {
    "videoIds": [2, 3]
  }
  ```
- Response: `200 OK`

### Delete List

**DELETE /api/video-lists/:id**

- Response: `200 OK`
- All videos in list get `video_list_id = null`

### Rename List

**PATCH /api/video-lists/:id**

- Request:
  ```json
  {
    "name": "New List Name"
  }
  ```
- Response: `200 OK`

### Bulk Operations on Videos in List

**POST /api/video-lists/:id/batch**

Operations are applied to the **whole list** so it stays homogeneous and advances
its status as a unit. The list `status` is recomputed and returned afterwards.

- Request:

  ```json
  {
    "operation": "confirmDownload | complete | ignore | addTag | removeTag | removeFromList",
    "tagName": "fancam",
    "confirm": false,
    "videoIds": [1, 2, 3]
  }
  ```

  - `confirmDownload` (`new → downloaded`), `complete`
    (`thumbnails_generated|ready_for_upload → completed`), `ignore` (`→ ignored`)
    apply to every video in the list; `videoIds` is ignored for these.
  - `addTag` / `removeTag` require `tagName`; `confirm: true` is needed for protected
    tags (`shorts`, `long_video`, `private`). Tags don't change status.
  - `removeFromList` detaches `videoIds` from the list (or the whole list if omitted).

- Response: `BatchResult`-style summary `{operation, processed, succeeded, failed, errors, status}`
- Note: `reparse` / `resync` are not exposed at the list level yet — they can split a
  list's status (e.g. `needs_review` vs `new`) and break the single-status invariant.
