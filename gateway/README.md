# wired-in-gateway

![Rust](https://img.shields.io/badge/Rust-blue) ![actix](https://img.shields.io/badge/actix-green)

API gateway and reverse proxy for the Wired-In platform. Routes dashboard requests to downstream services, manages workspaces and tiles in-memory, proxies feed/content requests to the aggregator and workers services, and provides SSE streaming.

## Tech Stack

- **Language:** Rust
- **Framework:** Actix-Web 4
- **Storage:** In-memory (`Arc<Mutex<Vec<_>>>`) — intended to be replaced with Postgres
- **Runtime:** Tokio

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/` | Service info |
| `GET` | `/api/feeds/{platform}` | Proxy feed requests to workers (:8000) |
| `GET` | `/api/content` | Proxy content requests to aggregator (:4000) |
| `GET` | `/api/search` | Proxy search requests to aggregator (:4000) |
| `POST` | `/api/feeds/subscribe` | Subscribe to a feed |
| `GET` | `/api/workspaces` | List workspaces |
| `POST` | `/api/workspaces` | Create workspace |
| `GET` | `/api/workspaces/{id}` | Get workspace |
| `PUT` | `/api/workspaces/{id}` | Update workspace |
| `DELETE` | `/api/workspaces/{id}` | Delete workspace |
| `GET` | `/api/tiles` | List tiles for a workspace |
| `POST` | `/api/tiles` | Create tile |
| `PUT` | `/api/tiles/{id}` | Update tile |
| `DELETE` | `/api/tiles/{id}` | Delete tile |
| `GET` | `/api/stream` | SSE event stream (`?workspace_id=xxx`) |

## Getting Started

### Prerequisites

- Rust 1.75+
- Cargo

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

## Project Structure

```
gateway/
├── src/
│   ├── main.rs              # App entry point, server setup
│   ├── state.rs             # Shared application state (in-memory stores)
│   ├── models.rs            # Workspace, Tile, and API data models
│   └── routes/
│       ├── mod.rs            # Route configuration
│       ├── proxy.rs          # Feed/content/search proxy to downstream services
│       ├── workspaces.rs     # Workspace CRUD endpoints
│       ├── tiles.rs          # Tile CRUD endpoints
│       └── stream.rs         # SSE streaming endpoint
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
