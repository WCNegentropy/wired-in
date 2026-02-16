# wired-in

![v0.1.0](https://img.shields.io/badge/version-0.1.0-blue)

A polyglot microservices-based multimedia and social media content aggregator dashboard. Pulls content from multiple platforms (Reddit, YouTube, X/Twitter, RSS feeds, and News APIs), normalizes it into a unified format, and displays it on a customizable, tile-based dark cyberpunk-themed React dashboard — with JWT authentication, OAuth social login (GitHub & Google), AES-256-GCM encrypted API key storage, workspace sharing, content analytics, bookmarks, saved searches, feed filtering, import/export, and push notifications.

> Scaffolded with [retro-vibecoder](https://github.com/WCNegentropy/retro-vibecoder) v0.2.2

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Dashboard (React + Vite + Zustand) :3000                               │
│   ↕  HTTP/SSE                                                          │
│ Gateway (Rust / Actix-Web) :8080                                       │
│   ↕ Proxy          ↕ Proxy                  ↕ CRUD (PostgreSQL/sqlx)   │
│ Aggregator (NestJS) :4000    Workers (Flask) :8000   ↕ Redis cache     │
│   ↕ fetch()                                          ↕ JWT Auth        │
│   └─────────── Workers (Flask) :8000 ────────────────────┘             │
│                 ↕ Platform APIs                                         │
│   Reddit JSON API │ YouTube API/RSS │ X API v2 │ RSS/Atom │ NewsAPI    │
├─────────────────────────────────────────────────────────────────────────┤
│ Infrastructure: PostgreSQL :5432  ·  Redis :6379                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Services

| Service | Tech Stack | Port | Description |
|---------|-----------|------|-------------|
| **[Gateway](./gateway/)** | Rust, Actix-Web | 8080 | API gateway & reverse proxy with JWT auth, rate limiting, workspace/tile CRUD, SSE streaming, API key management, bookmarks, saved searches, analytics, sharing, import/export |
| **[Aggregator](./aggregator/)** | TypeScript, NestJS | 4000 | Data normalization, Redis caching, PostgreSQL persistence, scheduled refresh, and aggregation layer with deduplication |
| **[Workers](./workers/)** | Python, Flask | 8000 | Platform content adapters (Reddit, YouTube, X, RSS, News) with per-request API key forwarding |
| **[Dashboard](./dashboard/)** | TypeScript, React, Vite | 3000 | Cyberpunk-themed tile-based content dashboard with auth, analytics, bookmarks, filters, and mobile responsiveness |
| **[CLI](./cli/)** | TypeScript, Commander.js | — | Local management tool for configuration, workspaces, and API keys |
| **[E2E Tests](./e2e/)** | TypeScript, Playwright | — | End-to-end test suite (Chromium + Firefox) |

## Features

- **Authentication** — Email/password registration & login with JWT tokens (24h expiry, auto-refresh)
- **OAuth Social Login** — GitHub and Google sign-in
- **Workspaces** — Create, switch, and delete workspaces to organize content feeds
- **Tiles** — Platform-specific configurable tiles with drag-and-drop grid layout (react-grid-layout)
- **SSE Live Updates** — Real-time content streaming via Server-Sent Events with Redis pub/sub
- **Feed Filters** — Per-tile keyword include/exclude, regex, NSFW handling, min score/comments, max age
- **Bookmarks** — Save content items across platforms with notes, search, and JSON export
- **Saved Searches** — Persist search queries with optional notification toggle
- **Content Analytics** — Click tracking with platform breakdown, top content, daily charts, CSV export
- **Workspace Sharing** — Generate time-expiring share links with permission controls
- **Import/Export** — Workspace backup/restore as JSON, OPML import for RSS feeds
- **API Key Management** — Per-platform key storage with AES-256-GCM encryption at rest
- **User Preferences** — Theme (dark/light), compact mode, refresh intervals, notification settings
- **Mobile Responsive** — Breakpoints at xs/sm/md/lg with collapsible sidebar and overflow menu
- **Content Deduplication** — Cross-platform duplicate detection via URL normalization and title similarity

## Security

- **JWT Authentication** — Argon2 password hashing, 24-hour token expiry, 15-minute refresh grace period
- **AES-256-GCM Encryption** — API keys encrypted at rest with configurable `ENCRYPTION_KEY`
- **Rate Limiting** — Token bucket: auth 10/min, API 100/min, proxy 30/min per user
- **CORS** — Configurable allowed origins via `CORS_ALLOWED_ORIGINS`
- **OAuth2** — State-validated GitHub and Google flows

See [docs/SECURITY.md](./docs/SECURITY.md) for details.

## Database

- **PostgreSQL** — 10 migrations: workspaces, users, tiles, API keys, preferences, OAuth links, bookmarks, shares, saved searches, content clicks
- **Redis** — Feed caching with TTL (60–600s), pub/sub for SSE streaming, distributed scheduler locking

## Getting Started

### Prerequisites

- Docker & Docker Compose
- (Optional) Platform API keys for full functionality

### Quick Start

1. **Clone and configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env to add your API keys and secrets
   ```

2. **Start the full stack:**

   ```bash
   docker compose up -d
   ```

3. **Access the dashboard:**

   Open [http://localhost:3000](http://localhost:3000) — register an account to get started.

### Environment Variables

See [`.env.example`](./.env.example) for all available configuration. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing JWT tokens (change in production) |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM API key encryption (optional) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth credentials (optional) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials (optional) |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Reddit API credentials (optional — public JSON API fallback) |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (optional — RSS fallback) |
| `X_BEARER_TOKEN` | X/Twitter API v2 bearer token (optional — mock data fallback) |
| `NEWSAPI_KEY` | NewsAPI.org API key (optional — Google News RSS fallback) |

### Development

Start individual services for development:

```bash
# Gateway only
docker compose up gateway

# Dashboard with hot reload
cd dashboard && npm run dev

# Workers
cd workers && python main.py
```

### Stopping

```bash
docker compose down
```

## Testing

- **E2E Tests** — Playwright suite covering auth, workspaces, and content flows (Chromium + Firefox)
- **CI** — GitHub Actions workflow with PostgreSQL 16 + Redis 7 service containers

```bash
cd e2e && npx playwright test
```

## Supported Platforms

- **Reddit** — Subreddit feeds via public JSON API
- **YouTube** — Channel/search feeds via Data API v3 or RSS
- **X (Twitter)** — Tweet search via API v2
- **RSS** — Generic RSS/Atom feed parsing
- **News** — Headlines via NewsAPI.org or Google News RSS

## API Reference

See [docs/API.md](./docs/API.md) for the full endpoint reference (46 endpoints).

## License

MIT
