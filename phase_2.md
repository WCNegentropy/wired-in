# Phase 2 Implementation Plan: Wired-In

## Context

**Repository:** `WCNegentropy/wired-in`
**Commit:** `c606d8fff355180fa7a6a7a1feb256647b1fd2fb`

This is a multimedia/social media content aggregator dashboard with 4 services:
- **gateway** (Rust/Actix-Web, port 8080) — API gateway with Postgres + Redis
- **aggregator** (TypeScript/NestJS, port 4000) — content normalization + caching
- **workers** (Python/Flask, port 8000) — platform feed fetchers
- **dashboard** (React/Vite, port 3000) — frontend SPA

Phase 1 wired up Postgres persistence for workspace/tile CRUD in the gateway and content write-through in the aggregator, plus Redis caching in the aggregator's CacheService. Several pieces were left incomplete. This plan finishes them and adds JWT auth.

## Implementation Order

Execute tasks in this exact order. Each step lists the files to modify, what to do, and key constraints.

---

### Step 1: Wire Redis caching into gateway proxy handlers

**File:** `gateway/src/routes/proxy.rs`

The infrastructure exists (`cache.rs` has `get_cached`/`set_cached`, `AppState` has `redis: ConnectionManager`) but proxy handlers don't use it.

For each of the three GET handlers (`get_feeds`, `get_content`, `search_content`):
1. At the start of the handler, clone `state.redis` into a mutable local
2. Build a cache key: `proxy:feeds:{platform}:{query_string}` for feeds, `proxy:content:{query_string}` for content, `proxy:search:{query_string}` for search
3. Call `crate::cache::get_cached(&mut redis, &cache_key).await` — if `Some(cached)`, return it as `HttpResponse::Ok().content_type("application/json").body(cached)` immediately
4. After successfully reading the upstream response body (the `Ok(body)` arm), call `let _ = crate::cache::set_cached(&mut redis, &cache_key, &body, TTL).await;` before returning. Use TTL 300 for feeds, 120 for content, 60 for search.

Do NOT cache `subscribe_feed` (it's a POST/write operation).

---

### Step 2: Add tile auto-refresh timer

**File:** `dashboard/src/components/TileCard.tsx`

After the existing `useEffect` that loads content on mount (around line 140), add a second `useEffect` that creates a `setInterval` based on `tile.refreshIntervalSecs`:

```typescript
useEffect(() => {
  if (tile.refreshIntervalSecs <= 0) return;
  const interval = setInterval(() => {
    loadContent();
  }, tile.refreshIntervalSecs * 1000);
  return () => clearInterval(interval);
}, [tile.refreshIntervalSecs, loadContent]);
```

No other changes needed in this file.

---

### Step 3: Build API client with CRUD functions and case mapping

**File:** `dashboard/src/lib/api.ts`

This file currently only has `fetchFeed`, `searchPlatform`, `fetchPlatforms`, `createSSEConnection`. It needs a complete rewrite.

Keep all existing exports but add:

1. **Case mapping helpers** — the gateway returns `snake_case` JSON (Rust serde default), the dashboard types use `camelCase`. Create recursive `mapKeys` utility functions (`snakeToCamel`, `camelToSnake`) that transform object keys. These must handle nested objects and arrays. Do NOT transform keys inside `config` objects that use platform-specific arbitrary keys — but since those keys are already lowercase single-word (`subreddit`, `sort`, `query`, etc.), the snake↔camel transform is a no-op on them, so recursive transform is safe.

2. **Generic API helpers** — `apiGet<T>(path)`, `apiPost<T>(path, body)`, `apiPut<T>(path, body)`, `apiDelete(path)` that:
   - Prepend `GATEWAY_URL`
   - Send/receive JSON
   - Apply `camelToSnake` on outgoing request bodies via `toApi()`
   - Apply `snakeToCamel` on response data via `fromApi()`
   - Include `Authorization: Bearer <token>` header if a token exists in `localStorage` (key: `wiredin_token`)
   - Throw on non-OK responses

3. **Workspace CRUD functions:**
   - `fetchWorkspaces(): Promise<Workspace[]>` → `GET /api/workspaces`
   - `createWorkspace(name, description): Promise<Workspace>` → `POST /api/workspaces`
   - `updateWorkspace(id, updates): Promise<Workspace>` → `PUT /api/workspaces/{id}`
   - `deleteWorkspace(id): Promise<void>` → `DELETE /api/workspaces/{id}`

4. **Tile CRUD functions:**
   - `fetchTiles(workspaceId): Promise<Tile[]>` → `GET /api/workspaces/{workspaceId}/tiles`
   - `createTile(workspaceId, tileData): Promise<Tile>` → `POST /api/workspaces/{workspaceId}/tiles`
   - `updateTile(tileId, updates): Promise<Tile>` → `PUT /api/tiles/{tileId}`
   - `deleteTile(tileId): Promise<void>` → `DELETE /api/tiles/{tileId}`

5. **Auth functions** (for Step 10):
   - `registerUser(email, password, name?): Promise<{token, user}>` → `POST /api/auth/register`
   - `loginUser(email, password): Promise<{token, user}>` → `POST /api/auth/login`
   - Both store the returned token in `localStorage` under `wiredin_token`
   - `logout()` removes the token
   - `isAuthenticated(): boolean` checks if token exists

6. **Update existing `fetchFeed`** to apply `fromApi()` to response items.

Import types from `../types` as needed.

---

### Step 4: Add `workspaceId` to dashboard Tile type

**File:** `dashboard/src/types/index.ts`

Add `workspaceId?: string;` to the `Tile` interface (optional, so existing client-generated tiles still work).

---

### Step 5: Connect store actions to gateway API

**File:** `dashboard/src/store/index.ts`

Major rewrite. Key changes:

1. **Remove the hardcoded `defaultWorkspace`** and initialize with `workspaces: []`, `activeWorkspaceId: null`.

2. **Add `initialLoading: boolean`** to state, initialized to `true`.

3. **Add `user: { id: string; email: string; name?: string } | null`** to state, initialized to `null`.

4. **Use `(set, get)` pattern** instead of just `(set)` in the `create()` call, needed for async actions that read state.

5. **Add `loadWorkspaces` async action** that calls `api.fetchWorkspaces()`, sets `workspaces` and `activeWorkspaceId` (first workspace), and sets `initialLoading: false`. Wrap in try/catch, set `initialLoading: false` even on error.

6. **Convert `addWorkspace` to async** — call `api.createWorkspace(name, description)` first, then update local state with the returned workspace.

7. **Convert `removeWorkspace` to async** — call `api.deleteWorkspace(id)` first, then remove from local state.

8. **Convert `addTile` to async** — call `api.createTile(workspaceId, { platform, config, position: { x: 0, y: 0, w: 4, h: 3 }, refreshIntervalSecs: 300 })` first, then add the returned tile to the workspace in local state.

9. **Convert `updateTile` to async** — call `api.updateTile(tileId, updates)` first, then replace the tile in local state with the returned data.

10. **Convert `removeTile` to async** — call `api.deleteTile(tileId)` first, then filter from local state.

11. **Keep `updateTilePositions` synchronous** (too frequent for round-trips). Leave as-is.

12. **Add auth actions:**
    - `login: async (email, password) => { const { user } = await api.loginUser(email, password); set({ user }); await get().loadWorkspaces(); }`
    - `register: async (email, password, name?) => { const { user } = await api.registerUser(email, password, name); set({ user }); await get().loadWorkspaces(); }`
    - `logout: () => { api.logout(); set({ user: null, workspaces: [], activeWorkspaceId: null }); }`

13. Keep all other actions unchanged (`setTileContent`, `setTileLoading`, `toggleSidebar`, `setAddTileModalOpen`, `setEditingTileId`, `setGlobalSearch`).

Update the `WiredInState` interface to match all new fields/signatures.

---

### Step 6: Load workspaces on app mount

**File:** `dashboard/src/App.tsx`

1. Import `useEffect` from React.
2. Subscribe to `initialLoading` and `loadWorkspaces` from the store.
3. Call `loadWorkspaces()` in a `useEffect` on mount.
4. If `initialLoading` is true, render a loading screen (simple centered div with "Loading workspaces...").
5. Keep existing dashboard render for the non-loading case.

---

### Step 7: Aggregator publishes to Redis on new content

**File:** `aggregator/src/cache/cache.service.ts`

Add a `publish` method to `CacheService`:

```typescript
async publish(channel: string, message: string): Promise<void> {
  await this.redis.publish(channel, message);
}
```

**File:** `aggregator/src/feeds/feeds.service.ts`

After `await this.contentService.setContentForPlatform(platform, normalized);` (around line 87), add:

```typescript
await this.cacheService.publish(
  `feed:updates:${platform}`,
  JSON.stringify({ platform, items: normalized, timestamp: new Date().toISOString() }),
);
```

---

### Step 8: Gateway SSE stream subscribes to Redis pub/sub

**File:** `gateway/Cargo.toml`

Add `async-stream = "0.3"` to `[dependencies]`.

**File:** `gateway/src/cache.rs`

Add a function to create a dedicated pub/sub subscriber connection (separate from the pooled `ConnectionManager` because pub/sub blocks):

```rust
pub async fn create_pubsub(redis_url: &str) -> Result<redis::aio::PubSub, redis::RedisError> {
    let client = redis::Client::open(redis_url)?;
    let conn = client.get_async_connection().await?;
    Ok(conn.into_pubsub())
}
```

**File:** `gateway/src/routes/stream.rs`

Complete rewrite. The handler should:

1. Read `REDIS_URL` from env (with same default as `state.rs`)
2. Create a pub/sub connection via `crate::cache::create_pubsub()`
3. Pattern-subscribe to `feed:updates:*`
4. Use `async_stream::stream!` or `futures::stream::unfold` to yield SSE events
5. Use `tokio::select!` to multiplex between:
   - Redis messages → emit as `event: content\ndata: {payload}\n\n`
   - A 15-second heartbeat timer → emit as `event: heartbeat\ndata: {...}\n\n`
6. If Redis connection fails, fall back to heartbeat-only mode
7. Return `HttpResponse::Ok()` with SSE headers (`text/event-stream`, `no-cache`, `keep-alive`, `X-Accel-Buffering: no`) and `.streaming()`

Keep the existing `StreamQuery` struct and `workspace_id` parameter.

---

### Step 9: Dashboard SSE hook dispatches to store

**New file:** `dashboard/src/hooks/useSSE.ts`

Create a custom hook `useSSE(workspaceId: string | null)` that:

1. Uses `useRef` to hold the `EventSource` instance
2. In a `useEffect` keyed on `workspaceId`:
   - If no workspaceId, return early
   - Call `createSSEConnection(workspaceId, () => {})` from `api.ts`
   - Add an event listener for `"content"` events
   - On content event: parse `JSON.parse(event.data)`, extract `platform` and `items`
   - Find all tiles in the active workspace matching that platform
   - Call `setTileContent(tileId, items.slice(0, maxItems))` for each matching tile
   - On cleanup: close the EventSource

**File:** `dashboard/src/App.tsx`

Import and call `useSSE(activeWorkspaceId)` after the loadWorkspaces effect. Subscribe to `activeWorkspaceId` from the store.

---

### Step 10: Gateway JWT auth — migration, utilities, endpoints

**New file:** `gateway/migrations/002_create_users.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    name           VARCHAR(255),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
```

**File:** `gateway/Cargo.toml`

Add `argon2 = "0.5"` to `[dependencies]`. The `jsonwebtoken = "9"` dependency already exists.

**New file:** `gateway/src/auth.rs`

Implement 4 functions:
- `hash_password(password: &str) -> Result<String, Error>` — uses `Argon2::default()` with random salt
- `verify_password(password: &str, hash: &str) -> bool` — parses hash and verifies
- `encode_jwt(user_id: Uuid, email: &str, secret: &str) -> Result<String, Error>` — creates a JWT with `sub` (user_id string), `email`, `exp` (24h from now), `iat`
- `decode_jwt(token: &str, secret: &str) -> Result<Claims, Error>` — validates and extracts claims

Define a `Claims` struct with `sub: String, email: String, exp: i64, iat: i64`.

**File:** `gateway/src/main.rs`

Add `mod auth;` and `mod middleware;` declarations.

**File:** `gateway/src/models.rs`

Add these structs:
- `RegisterRequest { email: String, password: String, name: Option<String> }`
- `LoginRequest { email: String, password: String }`
- `AuthResponse { token: String, user: UserInfo }`
- `UserInfo { id: Uuid, email: String, name: Option<String> }`

All derive `Debug, Serialize, Deserialize`.

**New file:** `gateway/src/routes/auth.rs`

Two handlers:
- `#[post("/register")]` — validates email uniqueness, hashes password with `auth::hash_password`, inserts user, returns JWT + user info. Read `JWT_SECRET` from env (default `"dev-secret-change-me"`).
- `#[post("/login")]` — looks up user by email, verifies password with `auth::verify_password`, returns JWT + user info. Return 401 for wrong credentials or missing user.

Both wrap responses in `ApiResponse::ok()` / `ApiResponse::err()`.

**File:** `gateway/src/routes/mod.rs`

Add `pub mod auth;`, mount as `web::scope("/auth").service(auth::register).service(auth::login)` inside the `/api` scope.

---

### Step 11: Gateway auth middleware extractor

**New file:** `gateway/src/middleware.rs`

Define `AuthenticatedUser { user_id: Uuid, email: String }` and implement `FromRequest` for it:
- Extract `Authorization` header
- Strip `Bearer ` prefix
- Call `auth::decode_jwt(token, secret)` using `JWT_SECRET` env var
- Parse `claims.sub` as `Uuid`
- Return `AuthenticatedUser` on success, `ErrorUnauthorized` on failure

---

### Step 12: Scope workspace/tile routes to authenticated user

**File:** `gateway/src/routes/workspaces.rs`

Add `user: crate::middleware::AuthenticatedUser` parameter to all 5 handlers.

- `list_workspaces`: change query to `WHERE user_id = $1` binding `user.user_id`
- `create_workspace`: add `user_id` to INSERT, bind `user.user_id`
- `get_workspace`: add `AND user_id = $2` to WHERE, bind `user.user_id`
- `update_workspace`: add `AND user_id = $2` to WHERE (in both the UPDATE and RETURNING query)
- `delete_workspace`: add `AND user_id = $2` to WHERE

**File:** `gateway/src/routes/tiles.rs`

For `create_tile`: after the workspace-exists check, also verify the workspace belongs to the user by adding `AND user_id = $2` to the EXISTS query. Add `user: crate::middleware::AuthenticatedUser` parameter.

For `update_tile` and `delete_tile`: add the `user` extractor. Join against workspaces to verify ownership: `WHERE tiles.id = $1 AND tiles.workspace_id IN (SELECT id FROM workspaces WHERE user_id = $2)`.

For `list_tiles`: add the `user` extractor, join/filter by workspace ownership.

Leave proxy routes (`proxy.rs`), SSE stream (`stream.rs`), health check, and root as public (no auth extractor).

---

### Step 13: Dashboard auth screen

**New file:** `dashboard/src/components/AuthScreen.tsx`

Create a login/register screen component:
- Toggle between "Login" and "Register" modes
- Form fields: email, password, and name (register only)
- Submit calls `store.login()` or `store.register()`
- Display error messages on failure
- Style with the existing CSS custom properties and cyberpunk theme (dark background, accent colors, etc.)

**File:** `dashboard/src/App.tsx`

Gate the dashboard behind authentication:
- Import `AuthScreen`
- Import `isAuthenticated` from `api.ts`
- If `!user && !isAuthenticated()`, render `<AuthScreen />` instead of the dashboard
- Add a logout button/link somewhere in the `Header` component or accessible from the UI
- On mount, if `isAuthenticated()` returns true but `user` is null, attempt to load workspaces (the token exists from a previous session)

**File:** `dashboard/src/components/Header.tsx`

Add a logout button that calls `store.logout()`. Show the user's email or name if available.

---

## Key Constraints

1. **Do NOT modify** `workers/` (Python service) — it's untouched in this phase
2. **Do NOT modify** `aggregator/src/entities/content-item.entity.ts` or the TypeORM entity structure
3. The gateway API wraps all responses in `{ "success": bool, "data": T, "error": string? }` via `ApiResponse`. The dashboard's `apiGet/apiPost/apiPut` must extract `.data` from this envelope.
4. The gateway uses `#[serde(rename_all = "lowercase")]` on the `Platform` enum — platforms serialize as `"reddit"`, `"youtube"`, etc.
5. `TileConfig` uses `#[serde(flatten)]` so config fields appear at the top level of the JSON, not nested under `extra`.
6. `docker-compose.yml` already has `JWT_SECRET` is NOT set — the gateway code should default to `"dev-secret-change-me"` but the env var should be documented. No changes to docker-compose are required for this phase.
7. All gateway migrations are in `gateway/migrations/` and auto-run on startup via `sqlx::migrate!("./migrations")` in `main.rs`.
8. Redis is at `redis://redis:6379` in Docker, `redis://localhost:6379` locally.
9. Postgres is at `postgres://postgres:postgres@db:5432/wiredin` in Docker.
