"""News platform worker.

Primary backend: NewsAPI.org (requires NEWS_API_KEY env var).
Fallback: Google News RSS feed (no key needed, limited functionality).
"""

import logging
import os
from datetime import datetime
from time import mktime
from typing import Optional

import feedparser
import requests

from workers.base import ContentItem, PlatformWorker

logger = logging.getLogger(__name__)

_NEWSAPI_BASE = "https://newsapi.org/v2"
_GOOGLE_NEWS_RSS = "https://news.google.com/rss"
_REQUEST_TIMEOUT = 15


class NewsWorker(PlatformWorker):
    """Adapter for news articles via NewsAPI.org or Google News RSS."""

    platform_name: str = "news"

    def __init__(self) -> None:
        self._api_key: Optional[str] = os.getenv("NEWS_API_KEY")
        self._session = requests.Session()

    # ----- helpers -----------------------------------------------------------

    def _resolve_api_key(self, config: dict) -> Optional[str]:
        """Return the API key from config (per-request header) or fall back to env var."""
        return config.get("api_key") or self._api_key

    @property
    def _has_api_key(self) -> bool:
        return bool(self._api_key)

    def _newsapi_article_to_content(self, article: dict) -> ContentItem:
        """Convert a NewsAPI article JSON object into a ContentItem."""
        source = article.get("source", {})
        published = article.get("publishedAt", "")

        return ContentItem(
            id=article.get("url", ""),
            platform="news",
            content_type="article",
            title=article.get("title", "") or "",
            description=(article.get("description", "") or "")[:500],
            url=article.get("url", ""),
            thumbnail_url=article.get("urlToImage", "") or "",
            author=article.get("author", "") or "",
            author_url="",
            published_at=published,
            metadata={
                "source_id": source.get("id", ""),
                "source_name": source.get("name", ""),
            },
        )

    def _google_news_entry_to_content(self, entry: feedparser.FeedParserDict) -> ContentItem:
        """Convert a Google News RSS entry into a ContentItem."""
        published = ""
        time_struct = entry.get("published_parsed")
        if time_struct:
            try:
                published = datetime.utcfromtimestamp(mktime(time_struct)).isoformat()
            except (ValueError, OverflowError):
                published = entry.get("published", "")

        return ContentItem(
            id=entry.get("id", entry.get("link", "")),
            platform="news",
            content_type="article",
            title=entry.get("title", ""),
            description=entry.get("summary", "")[:500],
            url=entry.get("link", ""),
            thumbnail_url="",
            author=entry.get("source", {}).get("title", "") if isinstance(entry.get("source"), dict) else "",
            author_url="",
            published_at=published,
            metadata={"source": "google_news_rss"},
        )

    def _fetch_google_news(self, query: str = "", max_items: int = 20) -> list[ContentItem]:
        """Fallback: fetch headlines from Google News RSS."""
        url = f"{_GOOGLE_NEWS_RSS}/search?q={query}&hl=en-US&gl=US&ceid=US:en" if query else _GOOGLE_NEWS_RSS
        try:
            parsed = feedparser.parse(url)
        except Exception as exc:
            logger.error("Google News RSS parse error: %s", exc)
            return []

        entries = parsed.entries[:max_items]
        return [self._google_news_entry_to_content(e) for e in entries]

    # ----- public interface --------------------------------------------------

    def fetch_feed(self, config: dict) -> list[ContentItem]:
        """Fetch news articles.

        Config keys:
            query (str): Search keywords (for /everything endpoint).
            category (str): business, entertainment, general, health,
                            science, sports, technology (for /top-headlines).
            country (str): 2-letter ISO code, e.g. "us". Default "us".
            sources (str): Comma-separated source IDs.
            page_size (int): Number of results. Default 20 (max 100).
        """
        query: str = config.get("query", "")
        category: str = config.get("category", "")
        country: str = config.get("country", "us")
        sources: str = config.get("sources", "")
        page_size: int = min(int(config.get("page_size", 20)), 100)

        resolved_key = self._resolve_api_key(config)
        if not resolved_key:
            logger.info("No API key available, falling back to Google News RSS.")
            return self._fetch_google_news(query=query, max_items=page_size)

        # Choose endpoint
        if query and not category:
            url = f"{_NEWSAPI_BASE}/everything"
            params: dict = {
                "q": query,
                "pageSize": page_size,
                "sortBy": config.get("sort_by", "publishedAt"),
                "apiKey": resolved_key,
            }
            if sources:
                params["sources"] = sources
        else:
            url = f"{_NEWSAPI_BASE}/top-headlines"
            params = {
                "pageSize": page_size,
                "apiKey": resolved_key,
            }
            if category:
                params["category"] = category
            if sources:
                params["sources"] = sources
            else:
                params["country"] = country
            if query:
                params["q"] = query

        try:
            resp = self._session.get(url, params=params, timeout=_REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") != "ok":
                logger.error("NewsAPI error: %s", data.get("message", "unknown"))
                return []
            return [self._newsapi_article_to_content(a) for a in data.get("articles", [])]
        except requests.RequestException as exc:
            logger.error("NewsAPI request failed: %s", exc)
            return self._fetch_google_news(query=query, max_items=page_size)

    def search(self, query: str, **kwargs) -> list[ContentItem]:
        """Search for news articles matching *query*.

        Keyword args:
            page_size (int): Max results. Default 20.
            sort_by (str): relevancy, popularity, publishedAt. Default "relevancy".
            sources (str): Comma-separated source IDs.
        """
        if not query:
            return []

        config = {
            "query": query,
            "page_size": kwargs.get("page_size", 20),
            "sort_by": kwargs.get("sort_by", "relevancy"),
            "sources": kwargs.get("sources", ""),
        }
        return self.fetch_feed(config)

    def health_check(self) -> dict:
        base = super().health_check()
        base["api_key_configured"] = self._has_api_key
        base["fallback"] = "google_news_rss" if not self._has_api_key else None
        return base
