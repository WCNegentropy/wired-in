# wired-in-gateway

![Rust](https://img.shields.io/badge/Rust-blue) ![actix](https://img.shields.io/badge/actix-green)

API gateway and reverse proxy for the Wired-In platform. Routes dashboard requests to downstream services, manages workspaces and tiles in PostgreSQL, proxies feed/content requests to the aggregator and workers services, handles JWT authentication with OAuth support, and provides SSE streaming via Redis pub/sub.

## Tech Stack

- **Language:** Rust
- **Framework:** Actix-Web 4
- **Database:** PostgreSQL (sqlx)
- **Cache:** Redis (pub/sub, TTL caching, distributed locking)
- **Auth:** JWT with Argon2 password hashing
- **Encryption:** AES-256-GCM for API key storage
- **Runtime:** Tokio

## API Endpoints

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | No | Register new user |
| `POST` | `/api/auth/login` | No | Login, returns JWT |
| `POST` | `/api/auth/refresh` | Yes | Refresh JWT token (15-min grace period) |
| `GET` | `/api/auth/oauth/{provider}` | No | Get OAuth redirect URL (github, google) |
| `POST` | `/api/auth/oauth/{provider}/callback` | No | Handle OAuth callback |

### Workspaces

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/workspaces` | Yes | List user's workspaces |
| `POST` | `/api/workspaces` | Yes | Create workspace |
| `GET` | `/api/workspaces/{id}` | Yes | Get workspace with tiles |
| `PUT` | `/api/workspaces/{id}` | Yes | Update workspace |
| `DELETE` | `/api/workspaces/{id}` | Yes | Delete workspace |
| `PUT` | `/api/workspaces/{id}/tile-positions` | Yes | Batch update tile positions |

### Tiles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/workspaces/{workspace_id}/tiles` | Yes | List tiles in workspace |
| `POST` | `/api/workspaces/{workspace_id}/tiles` | Yes | Create tile |
| `PUT` | `/api/tiles/{id}` | Yes | Update tile |
| `DELETE` | `/api/tiles/{id}` | Yes | Delete tile |

### Proxy (Aggregator & Workers)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/feeds/status` | Yes | Feed refresh status from aggregator |
| `GET` | `/api/feeds/{platform}` | Yes | Proxy feed request to workers |
| `GET` | `/api/content` | Yes | Proxy content request to aggregator |
| `GET` | `/api/search` | Yes | Proxy search to aggregator |
| `POST` | `/api/feeds/{platform}/subscribe` | Yes | Subscribe to a feed |

### API Keys

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/keys` | Yes | List API keys (values masked) |
| `POST` | `/api/keys` | Yes | Create API key (encrypted if key configured) |
| `PUT` | `/api/keys/{id}` | Yes | Update API key |
| `DELETE` | `/api/keys/{id}` | Yes | Delete API key |

### User Preferences

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/user/preferences` | Yes | Get user preferences |
| `PUT` | `/api/user/preferences` | Yes | Update preferences (JSONB merge) |

### Bookmarks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/bookmarks` | Yes | List bookmarks (optional `?platform=` filter) |
| `POST` | `/api/bookmarks` | Yes | Create bookmark |
| `PUT` | `/api/bookmarks/{id}` | Yes | Update bookmark notes |
| `DELETE` | `/api/bookmarks/{id}` | Yes | Delete bookmark |
| `GET` | `/api/bookmarks/check` | Yes | Check which content IDs are bookmarked |

### Saved Searches

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/saved-searches` | Yes | List saved searches |
| `POST` | `/api/saved-searches` | Yes | Create saved search |
| `PUT` | `/api/saved-searches/{id}` | Yes | Update saved search |
| `DELETE` | `/api/saved-searches/{id}` | Yes | Delete saved search |

### Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/analytics/click` | Yes | Track content click |
| `GET` | `/api/analytics/workspace/{id}` | Yes | Workspace analytics (`?period=7\|30\|all`) |
| `GET` | `/api/analytics/workspace/{id}/export` | Yes | Export analytics as CSV |

### Workspace Sharing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/workspaces/{id}/share` | Yes | Create share link |
| `DELETE` | `/api/workspaces/{id}/share/{share_id}` | Yes | Revoke share link |
| `GET` | `/api/workspaces/{id}/shares` | Yes | List active share links |
| `GET` | `/api/shared/{token}` | No | View shared workspace (public) |

### Import / Export

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/workspaces/{id}/export` | Yes | Export single workspace as JSON |
| `GET` | `/api/workspaces/export-all` | Yes | Export all workspaces as JSON |
| `POST` | `/api/workspaces/import` | Yes | Import workspaces from JSON |
| `POST` | `/api/import/opml` | Yes | Import RSS feeds from OPML |

### Streaming & Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/stream` | Yes | SSE event stream (`?workspace_id=`) |
| `GET` | `/health` | No | Aggregated health check |
| `GET` | `/` | No | Service info |

## Getting Started

### Prerequisites

- Rust 1.75+
- Cargo
- PostgreSQL 16+
- Redis 7+

### Installation

```bash
# Build
cargo build

# Run the application
cargo run

# Run tests
cargo test

# Build for release
cargo build --release
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `AGGREGATOR_URL` | `http://localhost:4000` | Aggregator service URL |
| `WORKERS_URL` | `http://localhost:8000` | Workers service URL |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `REDIS_URL` | — | Redis connection string (required) |
| `JWT_SECRET` | — | JWT signing secret (required) |
| `ENCRYPTION_KEY` | — | 32-byte hex key for AES-256-GCM (optional) |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `PUBLIC_URL` | `http://localhost:3000` | Base URL for share links |
| `OAUTH_REDIRECT_URI` | — | OAuth redirect URI |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth client secret |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |

## Project Structure

```
gateway/
├── migrations/
│   ├── 001_create_workspaces.sql
│   ├── 002_create_users.sql
│   ├── 003_create_api_keys.sql
│   ├── 004_add_user_preferences.sql
│   ├── 005_create_oauth_links.sql
│   ├── 006_create_bookmarks.sql
│   ├── 007_create_workspace_shares.sql
│   ├── 008_create_saved_searches.sql
│   ├── 009_create_content_clicks.sql
│   └── 010_add_encrypted_flag_to_api_keys.sql
├── src/
│   ├── main.rs              # App entry point, server setup, migration runner
│   ├── state.rs             # Shared AppState (DB pool, Redis, encryption key)
│   ├── models.rs            # All request/response data models
│   ├── auth.rs              # JWT encode/decode, Argon2 hashing
│   ├── middleware.rs         # AuthenticatedUser extractor (JWT validation)
│   ├── crypto.rs            # AES-256-GCM encrypt/decrypt
│   ├── cache.rs             # Redis get/set/publish, pub/sub init
│   ├── db.rs                # PostgreSQL pool initialization
│   ├── rate_limit.rs        # Token bucket rate limiter
│   └── routes/
│       ├── mod.rs            # Route configuration
│       ├── helpers.rs        # Shared helpers (tile_from_row)
│       ├── auth.rs           # Register, login, refresh
│       ├── oauth.rs          # GitHub & Google OAuth flows
│       ├── proxy.rs          # Feed/content/search proxy + API key forwarding
│       ├── workspaces.rs     # Workspace CRUD + tile positions
│       ├── tiles.rs          # Tile CRUD
│       ├── api_keys.rs       # API key management (encrypted)
│       ├── user.rs           # User preferences
│       ├── bookmarks.rs      # Content bookmarks
│       ├── saved_searches.rs # Saved search queries
│       ├── analytics.rs      # Click tracking + CSV export
│       ├── shares.rs         # Workspace sharing (tokens, permissions)
│       ├── import_export.rs  # JSON/OPML workspace import/export
│       └── stream.rs         # SSE endpoint (Redis pub/sub)
├── Cargo.toml
├── Dockerfile
└── README.md
```

## Docker

```bash
docker compose up
```

## License

MIT
