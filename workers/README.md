# wired-in-workers

![Python](https://img.shields.io/badge/Python-blue) ![flask](https://img.shields.io/badge/flask-green)

Platform content adapter service for the Wired-In platform. Provides 5 fully implemented platform workers that fetch, normalize, and serve content from external APIs. Each worker extends an abstract `PlatformWorker` base class with a unified `ContentItem` data model.

## Tech Stack

- **Language:** Python 3.12
- **Framework:** Flask 3.x
- **Key Libraries:** feedparser, praw (Reddit), requests, cachetools
- **Runtime:** Native / Gunicorn

## Supported Platforms

| Platform | Worker | API Key Required | Fallback |
|----------|--------|-----------------|----------|
| **Reddit** | `RedditWorker` | No (public JSON API) | — |
| **YouTube** | `YouTubeWorker` | `YOUTUBE_API_KEY` (optional) | YouTube RSS feeds |
| **X (Twitter)** | `XWorker` | `X_BEARER_TOKEN` (optional) | Mock/stub data |
| **RSS** | `RSSWorker` | No | — |
| **News** | `NewsWorker` | `NEWS_API_KEY` (optional) | Google News RSS |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api` | Service info |
| `GET` | `/api/feeds/platforms` | List available platforms |
| `GET` | `/api/feeds/<platform>` | Fetch feed (query params vary by platform) |
| `GET` | `/api/feeds/<platform>/search?q=<query>` | Search a platform |

## Getting Started

### Prerequisites

- Python 3.12+
- pip

### Installation

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the application
python main.py

# Run tests
pytest
```

## Project Structure

```
workers/
├── main.py                        # Flask app factory & entry point
├── requirements.txt               # Python dependencies
├── routes/
│   ├── __init__.py
│   └── feeds.py                   # Feed API blueprint (/api/feeds/*)
├── workers/
│   ├── __init__.py
│   ├── base.py                    # Abstract PlatformWorker & ContentItem dataclass
│   ├── registry.py                # WorkerRegistry singleton
│   ├── reddit_worker.py           # Reddit public JSON API adapter
│   ├── youtube_worker.py          # YouTube Data API v3 / RSS adapter
│   ├── x_worker.py                # X/Twitter API v2 adapter
│   ├── rss_worker.py              # Generic RSS/Atom feed parser
│   └── news_worker.py             # NewsAPI.org / Google News RSS adapter
├── tests/
│   ├── __init__.py
│   └── test_main.py               # Comprehensive test suite (32 tests)
├── Dockerfile
└── README.md
```

## Docker

```bash
docker compose up
```

## License

MIT
