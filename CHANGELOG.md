# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-02-16

Initial feature-complete release of the Wired-In content aggregation platform.

### Added

#### Phase 1 — Infrastructure (PR #3)
- PostgreSQL persistence for workspaces and tiles (sqlx, 1 migration)
- Redis caching for feed data with TTL
- Aggregator write-through persistence (TypeORM + PostgreSQL) with startup hydration
- Aggregator Redis caching (ioredis) with pub/sub for feed updates
- Dashboard connected to live API data with mock data fallback

#### Phase 2 — Auth & Real-Time (PR #5)
- JWT authentication (register, login, token refresh with 15-min grace period)
- Argon2 password hashing
- SSE real-time streaming with Redis pub/sub
- Dashboard CRUD for workspaces and tiles via gateway API
- Users database migration

#### Phase 3 — Production Readiness (PR #6)
- API key management with encrypted storage
- User preferences (theme, compact mode, refresh interval, notifications)
- Content deduplication (URL normalization + title similarity >80%)
- Rate limiting (token bucket: auth 10/min, API 100/min, proxy 30/min)
- Toast notification system in dashboard
- Connection status indicator (Live/Connecting/Offline)
- Debounced tile position persistence (2s)

#### Phase 4 — Social & Mobile (PR #7)
- OAuth social login (GitHub, Google) with state validation
- Content bookmarks with notes, search, platform grouping, JSON export
- Workspace sharing with time-expiring tokens and permission controls
- Shared workspace read-only view (`/shared/{token}`)
- JWT token auto-refresh before expiry
- Mobile responsive layout (xs/sm/md/lg breakpoints, collapsible sidebar, overflow menu)
- Scheduled background feed refresh with Redis distributed locking

#### Phase 5 — Advanced Features (PR #8)
- Saved searches with optional notification toggle
- Content analytics (click tracking, platform breakdown, top content, daily charts)
- Analytics CSV export
- Per-tile feed filters (keyword include/exclude, regex, NSFW hide/blur/show, min score/comments, max age)
- Workspace import/export as JSON
- OPML import for RSS feeds
- AES-256-GCM encryption for API keys at rest
- End-to-end test suite (Playwright, Chromium + Firefox)
- GitHub Actions CI workflow (PostgreSQL 16 + Redis 7)
- Service worker for offline support

### Infrastructure

- **Gateway:** Rust / Actix-Web — 46 API endpoints
- **Aggregator:** TypeScript / NestJS — feed normalization, caching, scheduling
- **Workers:** Python / Flask — 5 platform adapters (Reddit, YouTube, X, RSS, News)
- **Dashboard:** TypeScript / React / Vite / Zustand — 17 components, 1 hook
- **CLI:** TypeScript / Commander.js — local configuration management
- **Database:** PostgreSQL 16 (10 migrations) + Redis 7
- **E2E:** Playwright (Chromium + Firefox)
