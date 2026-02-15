# wired-in-aggregator

![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![nestjs](https://img.shields.io/badge/nestjs-green)

Data normalization, caching, and aggregation layer for the Wired-In platform. Sits between the gateway and the workers service — fetches raw platform feeds, normalizes content into a unified format, caches results with TTL, and provides aggregated content endpoints with filtering, sorting, and search.

## Tech Stack

- **Language:** TypeScript
- **Framework:** NestJS
- **Caching:** Custom in-memory TTL cache (with cron-based expiry cleanup)
- **Database:** TypeORM + Postgres configured (entities exist but primary data flow uses in-memory stores)
- **Runtime:** Node.js

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/content` | Aggregated content from all platforms (supports filtering & sorting) |
| `GET` | `/api/content/search` | Search across all platform content |
| `GET` | `/api/content/:platform` | Content for a specific platform |
| `GET` | `/api/feeds/platforms` | List available platforms |
| `GET` | `/api/feeds/:platform` | Fetch feed from a specific platform |
| `GET` | `/api/feeds/:platform/search` | Search within a platform feed |
| `POST` | `/api/feeds/refresh` | Force refresh all feeds |

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm

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
| `DATABASE_URL` | — | Postgres connection string |

## Project Structure

```
aggregator/
├── src/
│   ├── main.ts                          # App bootstrap
│   ├── app.module.ts                    # Root module
│   ├── app.controller.ts               # Root controller (health, info)
│   ├── app.service.ts                   # Root service
│   ├── dto/
│   │   └── content-query.dto.ts         # Query parameter DTOs
│   ├── entities/
│   │   ├── user.entity.ts               # User TypeORM entity
│   │   └── content-item.entity.ts       # ContentItem TypeORM entity
│   ├── content/
│   │   ├── content.module.ts            # Content module
│   │   ├── content.controller.ts        # Content endpoints
│   │   └── content.service.ts           # Content normalization & aggregation
│   ├── feeds/
│   │   ├── feeds.module.ts              # Feeds module
│   │   ├── feeds.controller.ts          # Feed endpoints
│   │   └── feeds.service.ts             # Feed fetching, caching, events
│   └── cache/
│       ├── cache.module.ts              # Cache module
│       └── cache.service.ts             # In-memory TTL cache with cron cleanup
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
