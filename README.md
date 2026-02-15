# wired-in

A polyglot microservices-based multimedia and social media content aggregator dashboard. Pulls content from multiple platforms (Reddit, YouTube, X/Twitter, RSS feeds, and News APIs), normalizes it into a unified format, and displays it on a customizable, tile-based dark cyberpunk-themed React dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Dashboard (React + Vite + Zustand) :3000                                │
│   ↕  HTTP/SSE                                                           │
│ Gateway (Rust / Actix-Web) :8080                                        │
│   ↕ Proxy          ↕ Proxy                  ↕ CRUD (in-memory)          │
│ Aggregator (NestJS) :4000    Workers (Flask) :8000   Workspaces/Tiles  │
│   ↕ fetch()                                                             │
│   └─────────── Workers (Flask) :8000 ────────────────────┘              │
│                 ↕ Platform APIs                                          │
│   Reddit JSON API │ YouTube API/RSS │ X API v2 │ RSS/Atom │ NewsAPI     │
├─────────────────────────────────────────────────────────────────────────┤
│ Infrastructure: PostgreSQL :5432  ·  Redis :6379                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Services

| Service | Tech Stack | Port | Description |
|---------|-----------|------|-------------|
| **[Gateway](./gateway/)** | Rust, Actix-Web | 8080 | API gateway & reverse proxy with workspace/tile CRUD and SSE streaming |
| **[Aggregator](./aggregator/)** | TypeScript, NestJS | 4000 | Data normalization, caching, and aggregation layer |
| **[Workers](./workers/)** | Python, Flask | 8000 | Platform content adapters (Reddit, YouTube, X, RSS, News) |
| **[Dashboard](./dashboard/)** | TypeScript, React, Vite | 3000 | Cyberpunk-themed tile-based content dashboard |
| **[CLI](./cli/)** | TypeScript, Commander.js | — | Local management tool for configuration, workspaces, and API keys |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- (Optional) Platform API keys for full functionality

### Quick Start

1. **Clone and configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env to add your API keys (optional — workers have fallback modes)
   ```

2. **Start the full stack:**

   ```bash
   docker compose up -d
   ```

3. **Access the dashboard:**

   Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

See [`.env.example`](./.env.example) for all available configuration. Key variables:

| Variable | Description |
|----------|-------------|
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Reddit API credentials (optional — public JSON API used as fallback) |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (optional — RSS fallback available) |
| `X_BEARER_TOKEN` | X/Twitter API v2 bearer token (optional — mock data returned without it) |
| `NEWSAPI_KEY` | NewsAPI.org API key (optional — Google News RSS fallback available) |

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

## Supported Platforms

- **Reddit** — Subreddit feeds via public JSON API
- **YouTube** — Channel/search feeds via Data API v3 or RSS
- **X (Twitter)** — Tweet search via API v2
- **RSS** — Generic RSS/Atom feed parsing
- **News** — Headlines via NewsAPI.org or Google News RSS

## License

MIT
