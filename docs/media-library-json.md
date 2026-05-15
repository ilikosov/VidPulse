# Media Library JSON Format

## 1) Назначение формата

Media Library JSON — это единый формат импорта/экспорта медиатеки в VidPulse.

- Поддерживается **только JSON**.
- CSV-формат и CSV-шаблоны больше не поддерживаются.
- Один и тот же формат используется для:
  - `POST /api/dictionary/import`
  - `GET /api/dictionary/export`

---

## 2) Структура

Корневой объект:

- `version` — версия формата (сейчас `1`)
- `mode` — режим импорта (`merge` | `replace`)
- `groups` — массив групп
- `soloArtists` — массив solo-артистов
- `events` — массив событий/локаций

Вложенные структуры:

- `groups[].artists` — артисты в контексте конкретной группы
- `groups[].artists[].songs` — песни артиста в контексте группы
- `groups[].songs` — песни на уровне группы
- `soloArtists[].songs` — песни solo-артиста

Краткая схема иерархии:

- `groups -> artists -> songs`
- `groups -> songs`
- `soloArtists -> songs`
- `events`

---

## 3) Правила

- `top-level songs[]` **запрещён**.
- Песни должны быть вложены только в:
  - `groups[].artists[].songs[]`
  - `groups[].songs[]`
  - `soloArtists[].songs[]`
- Один и тот же артист может состоять одновременно в нескольких группах.
- Артист может параллельно иметь solo activity.
- `merge` не удаляет отсутствующие в JSON сущности.
- `replace` считается опасным режимом и требует включённого env-флага.

---

## 4) Примеры сценариев

### 4.1 Partial import: добавить песни к существующей группе

```json
{
  "version": 1,
  "mode": "merge",
  "groups": [
    {
      "name": "LE SSERAFIM",
      "songs": [{ "title": "NEW GROUP SONG", "aliases": [] }]
    }
  ]
}
```

### 4.2 Добавить нового артиста в существующую группу

```json
{
  "version": 1,
  "mode": "merge",
  "groups": [
    {
      "name": "LE SSERAFIM",
      "artists": [
        {
          "name": "NEW ARTIST",
          "membership": {
            "activityType": "group",
            "status": "active",
            "from": "2026-01-01",
            "to": null,
            "isPrimary": false
          },
          "songs": []
        }
      ]
    }
  ]
}
```

### 4.3 Один артист в двух группах

```json
{
  "version": 1,
  "mode": "merge",
  "groups": [
    {
      "name": "GROUP A",
      "artists": [
        {
          "name": "SHARED ARTIST",
          "membership": {
            "activityType": "group",
            "status": "active"
          },
          "songs": []
        }
      ]
    },
    {
      "name": "GROUP B",
      "artists": [
        {
          "name": "SHARED ARTIST",
          "membership": {
            "activityType": "group",
            "status": "active"
          },
          "songs": []
        }
      ]
    }
  ]
}
```

### 4.4 Solo artist

```json
{
  "version": 1,
  "mode": "merge",
  "soloArtists": [
    {
      "name": "SOMI",
      "membership": {
        "activityType": "solo",
        "status": "active",
        "from": "2019-06-13",
        "to": null,
        "isPrimary": true
      },
      "songs": [{ "title": "DUMB DUMB", "aliases": [] }]
    }
  ]
}
```

### 4.5 Former membership

```json
{
  "version": 1,
  "mode": "merge",
  "groups": [
    {
      "name": "GROUP A",
      "artists": [
        {
          "name": "FORMER MEMBER",
          "membership": {
            "activityType": "group",
            "status": "former",
            "from": "2020-01-01",
            "to": "2023-12-31",
            "isPrimary": false
          },
          "songs": []
        }
      ]
    }
  ]
}
```

### 4.6 Event aliases

```json
{
  "version": 1,
  "mode": "merge",
  "events": [
    {
      "name": "KYUNGIL UNIVERSITY FESTIVAL",
      "aliases": ["경일대 축제", "경일대"]
    }
  ]
}
```

---

## 5) Env flags

### Backend

```env
MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED=true
```

### Frontend

```env
VITE_MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED=true
```

---

## 6) API

- `POST /api/dictionary/import` — импорт Media Library JSON
- `GET /api/dictionary/export` — экспорт Media Library JSON
- `GET /api/dictionary/schema` — скачать JSON Schema
- `GET /api/dictionary/example` — скачать пример JSON
- `DELETE /api/dictionary/clear` — очистить справочники медиатеки (dangerous)

---

## 7) Safety

- `clear` не удаляет видео (`videos` сохраняются).
- Dangerous API по умолчанию выключены (нужно явно включать env-флагами).
