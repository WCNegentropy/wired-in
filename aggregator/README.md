# wired-in-aggregator

![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![nestjs](https://img.shields.io/badge/nestjs-green)

Data normalization, caching, and aggregation layer for the Wired-In platform. Sits between the gateway and the workers service — fetches raw platform feeds, normalizes content into a unified format, caches results in Redis with TTL, persists to PostgreSQL via TypeORM with write-through caching, provides cross-platform deduplication, and runs scheduled background refreshes with distributed locking.

## Tech Stack

- **Language:** TypeScript
- **Framework:** NestJS
- **Caching:** Redis (ioredis) with per-platform TTLs and pub/sub
- **Database:** PostgreSQL (TypeORM) with write-through persistence and startup hydration
- **Scheduler:** @nestjs/schedule (interval-based with Redis distributed locking)
- **Runtime:** Node.js

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/content` | Aggregated content from all platforms (supports filtering, sorting, pagination) |
| `GET` | `/api/content/search` | Search across all platform content |
| `GET` | `/api/content/:platform` | Content for a specific platform |
| `GET` | `/api/feeds/platforms` | List available platforms |
| `GET` | `/api/feeds/status` | Per-platform refresh status (last refresh time, item count, errors) |
| `GET` | `/api/feeds/:platform` | Fetch feed from a specific platform |
| `GET` | `/api/feeds/:platform/search` | Search within a platform feed |
| `POST` | `/api/feeds/refresh` | Force refresh all feeds |

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- PostgreSQL 16+
- Redis 7+

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run start:dev

# Build for production
npm run build

# Run tests
npm test
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `WORKERS_URL` | `http://localhost:8000` | Workers service URL |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `REFRESH_INTERVAL_SECS` | `300` | Background refresh interval in seconds (5 min default) |
| `NODE_ENV` | `development` | Environment (controls database auto-sync) |

## Project Structure

```
aggregator/
├── src/
│   ├── main.ts                          # App bootstrap
│   ├── app.module.ts                    # Root module (TypeORM, Redis, Schedule, EventEmitter)
│   ├── app.controller.ts               # Root controller (health, info)
│   ├── app.service.ts                   # Root service
│   ├── dto/
│   │   └── content-query.dto.ts         # Query parameter DTOs
│   ├── entities/
│   │   ├── user.entity.ts               # User TypeORM entity
│   │   └── content-item.entity.ts       # ContentItem entity (JSONB metadata, upsert support)
│   ├── content/
│   │   ├── content.module.ts            # Content module
│   │   ├── content.controller.ts        # Content endpoints
│   │   └── content.service.ts           # Aggregation, deduplication (URL + title similarity), search, sorting
│   ├── feeds/
│   │   ├── feeds.module.ts              # Feeds module
│   │   ├── feeds.controller.ts          # Feed endpoints
│   │   └── feeds.service.ts             # Feed fetching, Redis caching, pub/sub broadcast
│   ├── cache/
│   │   ├── cache.module.ts              # Global cache module
│   │   └── cache.service.ts             # Redis client (ioredis): get/set/delete/setnx/publish
│   └── scheduler/
│       ├── scheduler.module.ts          # Scheduler module
│       └── scheduler.service.ts         # Interval-based refresh with Redis distributed lock
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## Docker

```bash
docker compose up
```

## License

MIT
