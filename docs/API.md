# Wired-In API Reference

All API endpoints are served by the **Gateway** service on port `8080`. Endpoints marked with **Auth: Yes** require a `Authorization: Bearer <JWT>` header.

## Table of Contents

- [Authentication](#authentication)
- [Workspaces](#workspaces)
- [Tiles](#tiles)
- [Feeds & Content (Proxy)](#feeds--content-proxy)
- [API Keys](#api-keys)
- [User Preferences](#user-preferences)
- [Bookmarks](#bookmarks)
- [Saved Searches](#saved-searches)
- [Analytics](#analytics)
- [Workspace Sharing](#workspace-sharing)
- [Import / Export](#import--export)
- [Streaming](#streaming)
- [Health](#health)

---

## Authentication

### `POST /api/auth/register`

Register a new user account.

- **Auth:** No
- **Body:** `{ "email": string, "password": string, "name"?: string }`
- **Response:** `{ "token": string, "user": { "id": string, "email": string, "name": string } }`

### `POST /api/auth/login`

Login with email and password.

- **Auth:** No
- **Body:** `{ "email": string, "password": string }`
- **Response:** `{ "token": string, "user": { "id": string, "email": string, "name": string } }`

### `POST /api/auth/refresh`

Refresh an expired JWT token. Allows up to 15 minutes past expiry.

- **Auth:** Yes (expired tokens accepted within grace period)
- **Body:** None
- **Response:** `{ "token": string, "user": { "id": string, "email": string, "name": string } }`

### `GET /api/auth/oauth/{provider}`

Get OAuth authorization URL. Supported providers: `github`, `google`.

- **Auth:** No
- **Response:** `{ "url": string }`

### `POST /api/auth/oauth/{provider}/callback`

Handle OAuth callback after user authorization.

- **Auth:** No
- **Body:** `{ "code": string, "state": string }`
- **Response:** `{ "token": string, "user": { "id": string, "email": string, "name": string } }`

---

## Workspaces

### `GET /api/workspaces`

List all workspaces for the authenticated user.

- **Auth:** Yes
- **Response:** `Workspace[]`

### `POST /api/workspaces`

Create a new workspace.

- **Auth:** Yes
- **Body:** `{ "name": string, "description"?: string }`
- **Response:** `Workspace`

### `GET /api/workspaces/{id}`

Get a workspace with its tiles.

- **Auth:** Yes
- **Response:** `Workspace` (includes `tiles[]`)

### `PUT /api/workspaces/{id}`

Update a workspace.

- **Auth:** Yes
- **Body:** `{ "name"?: string, "description"?: string }`
- **Response:** `Workspace`

### `DELETE /api/workspaces/{id}`

Delete a workspace and all its tiles.

- **Auth:** Yes
- **Response:** `204 No Content`

### `PUT /api/workspaces/{id}/tile-positions`

Batch update tile positions (used for drag-and-drop persistence).

- **Auth:** Yes
- **Body:** `{ "positions": { "<tile_id>": { "x": number, "y": number, "w": number, "h": number } } }`
- **Response:** `200 OK`

---

## Tiles

### `GET /api/workspaces/{workspace_id}/tiles`

List all tiles in a workspace.

- **Auth:** Yes
- **Response:** `Tile[]`

### `POST /api/workspaces/{workspace_id}/tiles`

Create a tile in a workspace.

- **Auth:** Yes
- **Body:** `{ "platform": "reddit"|"youtube"|"x"|"rss"|"news", "config": TileConfig, "position"?: TilePosition, "refresh_interval_secs"?: number }`
- **Response:** `Tile`

### `PUT /api/tiles/{id}`

Update a tile's configuration.

- **Auth:** Yes
- **Body:** `{ "config"?: TileConfig, "position"?: TilePosition, "refresh_interval_secs"?: number }`
- **Response:** `Tile`

### `DELETE /api/tiles/{id}`

Delete a tile.

- **Auth:** Yes
- **Response:** `204 No Content`

---

## Feeds & Content (Proxy)

These endpoints proxy requests to the aggregator and workers services.

### `GET /api/feeds/status`

Get per-platform refresh status from the aggregator.

- **Auth:** Yes
- **Response:** `{ "<platform>": { "last_refresh_at": string, "item_count": number, "error"?: string } }`

### `GET /api/feeds/{platform}`

Fetch feed content for a platform. Query parameters vary by platform:

- **Auth:** Yes
- **Query params:**
  - Reddit: `?subreddit=<name>&sort=hot|new|top|rising&limit=<n>`
  - YouTube: `?q=<query>&channel_id=<id>&limit=<n>`
  - X: `?q=<query>&user=<handle>&limit=<n>`
  - RSS: `?url=<feed_url>&limit=<n>`
  - News: `?q=<query>&category=<cat>&country=<cc>&limit=<n>`
- **Response:** `ContentItem[]`

### `GET /api/content`

Get aggregated content from all platforms via the aggregator.

- **Auth:** Yes
- **Query params:** `?platform=<name>&sort=date|score|relevance&limit=<n>&offset=<n>`
- **Response:** `ContentItem[]`

### `GET /api/search`

Search across all aggregated content.

- **Auth:** Yes
- **Query params:** `?q=<query>&platform=<name>`
- **Response:** `ContentItem[]`

### `POST /api/feeds/{platform}/subscribe`

Subscribe to a feed for streaming updates.

- **Auth:** Yes
- **Body:** Platform-specific subscription config
- **Response:** `200 OK`

---

## API Keys

### `GET /api/keys`

List all API keys for the authenticated user. Key values are masked.

- **Auth:** Yes
- **Response:** `ApiKeyResponse[]` — `{ "id": string, "platform": string, "key_name": string, "key_value": "****...", "has_secret": boolean, "is_active": boolean }`

### `POST /api/keys`

Create a new API key. Encrypted at rest if `ENCRYPTION_KEY` is configured.

- **Auth:** Yes
- **Body:** `{ "platform": string, "key_name": string, "key_value": string, "key_secret"?: string }`
- **Response:** `ApiKeyResponse`

### `PUT /api/keys/{id}`

Update an API key.

- **Auth:** Yes
- **Body:** `{ "key_value"?: string, "key_secret"?: string, "is_active"?: boolean }`
- **Response:** `ApiKeyResponse`

### `DELETE /api/keys/{id}`

Delete an API key.

- **Auth:** Yes
- **Response:** `204 No Content`

---

## User Preferences

### `GET /api/user/preferences`

Get the authenticated user's preferences.

- **Auth:** Yes
- **Response:** `{ "theme": "dark"|"light", "default_refresh_interval": number, "notifications_enabled": boolean, "compact_mode": boolean }`

### `PUT /api/user/preferences`

Update preferences (JSONB merge — only send fields to change).

- **Auth:** Yes
- **Body:** `{ "theme"?: string, "default_refresh_interval"?: number, "notifications_enabled"?: boolean, "compact_mode"?: boolean }`
- **Response:** `UserPreferences`

---

## Bookmarks

### `GET /api/bookmarks`

List all bookmarks. Optionally filter by platform.

- **Auth:** Yes
- **Query params:** `?platform=<name>`
- **Response:** `BookmarkResponse[]`

### `POST /api/bookmarks`

Bookmark a content item.

- **Auth:** Yes
- **Body:** `{ "content_id": string, "platform": string, "title": string, "url": string, "thumbnail_url"?: string, "author"?: string, "notes"?: string }`
- **Response:** `BookmarkResponse`

### `PUT /api/bookmarks/{id}`

Update bookmark notes.

- **Auth:** Yes
- **Body:** `{ "notes": string }`
- **Response:** `BookmarkResponse`

### `DELETE /api/bookmarks/{id}`

Delete a bookmark.

- **Auth:** Yes
- **Response:** `204 No Content`

### `GET /api/bookmarks/check`

Check which content IDs are bookmarked by the user.

- **Auth:** Yes
- **Query params:** `?ids=<id1>,<id2>,...`
- **Response:** `{ "<content_id>": "<bookmark_id>" }`

---

## Saved Searches

### `GET /api/saved-searches`

List all saved searches.

- **Auth:** Yes
- **Response:** `SavedSearchResponse[]`

### `POST /api/saved-searches`

Create a saved search.

- **Auth:** Yes
- **Body:** `{ "name": string, "query": string, "platforms"?: string[], "notify"?: boolean }`
- **Response:** `SavedSearchResponse`

### `PUT /api/saved-searches/{id}`

Update a saved search.

- **Auth:** Yes
- **Body:** `{ "name"?: string, "query"?: string, "platforms"?: string[], "notify"?: boolean }`
- **Response:** `SavedSearchResponse`

### `DELETE /api/saved-searches/{id}`

Delete a saved search.

- **Auth:** Yes
- **Response:** `204 No Content`

---

## Analytics

### `POST /api/analytics/click`

Track a content click event.

- **Auth:** Yes
- **Body:** `{ "workspace_id": string, "tile_id"?: string, "content_id": string, "platform": string, "title"?: string, "url"?: string }`
- **Response:** `200 OK`

### `GET /api/analytics/workspace/{id}`

Get analytics for a workspace.

- **Auth:** Yes
- **Query params:** `?period=7|30|all` (default: `7`)
- **Response:**
  ```json
  {
    "workspace_id": "string",
    "total_clicks": 0,
    "platform_breakdown": [{ "platform": "string", "count": 0 }],
    "top_content": [{ "content_id": "string", "title": "string", "url": "string", "platform": "string", "clicks": 0 }],
    "daily_clicks": [{ "date": "2026-01-01", "count": 0 }],
    "period_start": "2026-01-01T00:00:00Z",
    "period_end": "2026-01-08T00:00:00Z"
  }
  ```

### `GET /api/analytics/workspace/{id}/export`

Export workspace analytics as CSV.

- **Auth:** Yes
- **Response:** `text/csv` file download

---

## Workspace Sharing

### `POST /api/workspaces/{id}/share`

Create a share link for a workspace.

- **Auth:** Yes
- **Body:** `{ "permission"?: "view"|"edit", "expires_in_hours"?: number }`
- **Response:** `{ "share_url": string, "token": string, "permission": string, "expires_at"?: string }`

### `GET /api/workspaces/{id}/shares`

List active share links for a workspace.

- **Auth:** Yes
- **Response:** `ShareResponse[]`

### `DELETE /api/workspaces/{id}/share/{share_id}`

Revoke a share link.

- **Auth:** Yes
- **Response:** `204 No Content`

### `GET /api/shared/{token}`

View a shared workspace. This is a public endpoint.

- **Auth:** No
- **Response:** `{ "workspace": Workspace, "owner": string }`

---

## Import / Export

### `GET /api/workspaces/{id}/export`

Export a single workspace as JSON.

- **Auth:** Yes
- **Response:** `WorkspaceExport`

### `GET /api/workspaces/export-all`

Export all user workspaces as JSON.

- **Auth:** Yes
- **Response:** `WorkspaceExport`

### `POST /api/workspaces/import`

Import workspaces from a JSON export.

- **Auth:** Yes
- **Body:** `WorkspaceExport` (JSON)
- **Response:** `{ "workspace_ids": string[], "workspace_count": number, "tile_count": number }`

### `POST /api/import/opml`

Import RSS feeds from an OPML file. Creates a workspace with one tile per feed.

- **Auth:** Yes
- **Body:** `{ "xml_content": string, "workspace_name"?: string }`
- **Response:** `{ "workspace_id": string, "workspace_name": string, "tile_count": number }`

---

## Streaming

### `GET /api/stream`

Server-Sent Events (SSE) endpoint for real-time content updates.

- **Auth:** Yes (via query param or header)
- **Query params:** `?workspace_id=<id>`
- **Events:**
  - `content` — `{ "platform": string, "items": ContentItem[] }`
  - Heartbeat sent periodically to keep the connection alive

---

## Health

### `GET /health`

Aggregated health check across all services.

- **Auth:** No
- **Response:** `{ "status": "ok" }`

### `GET /`

Service info.

- **Auth:** No
- **Response:** `{ "service": "wired-in-gateway", "version": "0.1.0" }`

---

## Data Models

### ContentItem

```json
{
  "id": "string",
  "platform": "reddit|youtube|x|rss|news",
  "content_type": "string",
  "title": "string",
  "description": "string",
  "url": "string",
  "thumbnail_url": "string|null",
  "author": "string",
  "author_url": "string|null",
  "score": "number|null",
  "comment_count": "number|null",
  "nsfw": "boolean|null",
  "published_at": "ISO 8601",
  "fetched_at": "ISO 8601",
  "metadata": {}
}
```

### Workspace

```json
{
  "id": "string",
  "name": "string",
  "description": "string|null",
  "tiles": "Tile[]",
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601"
}
```

### Tile

```json
{
  "id": "string",
  "workspace_id": "string",
  "platform": "reddit|youtube|x|rss|news",
  "config": {
    "subreddit": "string",
    "sort": "hot|new|top|rising",
    "channel_id": "string",
    "query": "string",
    "feed_url": "string",
    "category": "string",
    "country": "string",
    "max_items": "number",
    "filters": {
      "keywords": ["string"],
      "keywords_exclude": ["string"],
      "regex": "string",
      "nsfw_filter": "hide|blur|show",
      "min_score": "number",
      "min_comments": "number",
      "max_age": "number (seconds)"
    }
  },
  "position": { "x": 0, "y": 0, "w": 4, "h": 3 },
  "refresh_interval_secs": 300
}
```

### WorkspaceExport

```json
{
  "version": "1.0",
  "exported_at": "ISO 8601",
  "workspaces": [
    {
      "name": "string",
      "description": "string|null",
      "tiles": [
        {
          "platform": "string",
          "config": {},
          "position": {}
        }
      ]
    }
  ]
}
```

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| Auth (`/api/auth/*`) | 10 requests/min per IP |
| API (`/api/*`) | 100 requests/min per user |
| Proxy (`/api/feeds/*`, `/api/content`, `/api/search`) | 30 requests/min per user |
