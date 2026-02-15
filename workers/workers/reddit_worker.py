"""Reddit platform worker.

Fetches posts from Reddit using the public JSON API (no API key required).
Adds a .json suffix to standard Reddit URLs to get structured data.
"""

import logging
import time
from datetime import datetime
from typing import Optional

import requests

from workers.base import ContentItem, PlatformWorker

logger = logging.getLogger(__name__)

_REDDIT_BASE = "https://www.reddit.com"
_USER_AGENT = "WiredIn-Workers/0.1.0 (content-aggregator)"
_REQUEST_TIMEOUT = 15  # seconds
_RATE_LIMIT_DELAY = 1.0  # be polite to Reddit


class RedditWorker(PlatformWorker):
    """Adapter for Reddit using the public JSON API."""

    platform_name: str = "reddit"

    def __init__(self) -> None:
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": _USER_AGENT})
        self._last_request_time: float = 0.0

    # ----- internal helpers -------------------------------------------------

    def _rate_limit(self) -> None:
        """Ensure we don't hammer Reddit's servers."""
        elapsed = time.time() - self._last_request_time
        if elapsed < _RATE_LIMIT_DELAY:
            time.sleep(_RATE_LIMIT_DELAY - elapsed)
        self._last_request_time = time.time()

    def _get_json(self, url: str, params: Optional[dict] = None) -> dict:
        """Perform a rate-limited GET and return the parsed JSON."""
        self._rate_limit()
        response = self._session.get(url, params=params, timeout=_REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.json()

    def _post_to_content_item(self, post_data: dict) -> ContentItem:
        """Convert a single Reddit post JSON object into a ContentItem."""
        data = post_data.get("data", post_data)
        created_utc = data.get("created_utc", 0)
        published = datetime.utcfromtimestamp(created_utc).isoformat() if created_utc else ""

        thumbnail = data.get("thumbnail", "")
        if thumbnail in ("self", "default", "nsfw", "spoiler", ""):
            thumbnail = ""

        return ContentItem(
            id=data.get("name", data.get("id", "")),
            platform="reddit",
            content_type="post",
            title=data.get("title", ""),
            description=data.get("selftext", "")[:500],
            url=f"{_REDDIT_BASE}{data.get('permalink', '')}",
            thumbnail_url=thumbnail,
            author=data.get("author", "[deleted]"),
            author_url=f"{_REDDIT_BASE}/user/{data.get('author', '')}" if data.get("author") else "",
            score=data.get("score"),
            comment_count=data.get("num_comments"),
            published_at=published,
            metadata={
                "subreddit": data.get("subreddit", ""),
                "is_self": data.get("is_self", False),
                "domain": data.get("domain", ""),
                "upvote_ratio": data.get("upvote_ratio"),
                "flair": data.get("link_flair_text", ""),
            },
        )

    # ----- public interface --------------------------------------------------

    def fetch_feed(self, config: dict) -> list[ContentItem]:
        """Fetch posts from a subreddit.

        Config keys:
            subreddit (str): Subreddit name (without /r/). Default "all".
            sort (str): One of hot, new, top, rising. Default "hot".
            limit (int): Number of posts (max 100). Default 25.
            time_filter (str): For top/controversial: hour, day, week, month,
                               year, all. Default "day".
        """
        subreddit = config.get("subreddit", "all")
        sort = config.get("sort", "hot")
        limit = min(int(config.get("limit", 25)), 100)
        time_filter = config.get("time_filter", "day")

        url = f"{_REDDIT_BASE}/r/{subreddit}/{sort}.json"
        params: dict = {"limit": limit, "raw_json": 1}
        if sort in ("top", "controversial"):
            params["t"] = time_filter

        try:
            data = self._get_json(url, params=params)
            children = data.get("data", {}).get("children", [])
            return [self._post_to_content_item(child) for child in children]
        except requests.RequestException as exc:
            logger.error("Reddit fetch_feed failed for r/%s: %s", subreddit, exc)
            return []

    def search(self, query: str, **kwargs) -> list[ContentItem]:
        """Search Reddit for posts matching *query*.

        Keyword args:
            subreddit (str): Restrict search to a subreddit.
            sort (str): relevance, hot, top, new, comments. Default "relevance".
            limit (int): Max results. Default 25.
            time_filter (str): hour, day, week, month, year, all. Default "all".
        """
        subreddit = kwargs.get("subreddit", "all")
        sort = kwargs.get("sort", "relevance")
        limit = min(int(kwargs.get("limit", 25)), 100)
        time_filter = kwargs.get("time_filter", "all")

        url = f"{_REDDIT_BASE}/r/{subreddit}/search.json"
        params = {
            "q": query,
            "sort": sort,
            "limit": limit,
            "t": time_filter,
            "restrict_sr": "1" if subreddit != "all" else "0",
            "raw_json": 1,
        }

        try:
            data = self._get_json(url, params=params)
            children = data.get("data", {}).get("children", [])
            return [self._post_to_content_item(child) for child in children]
        except requests.RequestException as exc:
            logger.error("Reddit search failed for '%s': %s", query, exc)
            return []
