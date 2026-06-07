# Video Lists API

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

- Response: array of lists `{id, name, color, countVideos}`

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
  - `409 Conflict` if any video already in another list or list limit exceeded

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

- Request:
  ```json
  {
    "operation": "removeFromList | addTag | removeTag | confirmDownload | reparse",
    "videoIds": [1, 2, 3]
  }
  ```
- Response: summary of operation results
- Confirmation modal required only for operations affecting video visibility (e.g., adding `shorts` or `private` tags)
