"""X / Twitter platform worker.

Uses the X API v2 when a Bearer token is available (X_BEARER_TOKEN env var).
Returns stub / mock data when no credentials are configured so the rest of
the system can still function during development.
"""

import logging
import os
from datetime import datetime
from typing import Optional

import requests

from workers.base import ContentItem, PlatformWorker

logger = logging.getLogger(__name__)

_API_BASE = "https://api.twitter.com/2"
_REQUEST_TIMEOUT = 15


class XWorker(PlatformWorker):
    """Adapter for X (formerly Twitter) using API v2."""

    platform_name: str = "x"

    def __init__(self) -> None:
        self._bearer_token: Optional[str] = os.getenv("X_BEARER_TOKEN")
        self._session = requests.Session()
        if self._bearer_token:
            self._session.headers.update({
                "Authorization": f"Bearer {self._bearer_token}",
            })

    # ----- helpers -----------------------------------------------------------

    def _resolve_token(self, config: dict) -> Optional[str]:
        """Return the bearer token from config (per-request header) or fall back to env var."""
        return config.get("api_key") or self._bearer_token

    def _get_session(self, config: dict) -> requests.Session:
        """Return a session configured with the appropriate bearer token."""
        token = self._resolve_token(config)
        if token and token != self._bearer_token:
            session = requests.Session()
            session.headers.update({"Authorization": f"Bearer {token}"})
            return session
        return self._session

    @property
    def _has_token(self) -> bool:
        return bool(self._bearer_token)

    def _tweet_to_content_item(self, tweet: dict, includes: Optional[dict] = None) -> ContentItem:
        """Convert a v2 tweet object into a ContentItem."""
        tweet_id = tweet.get("id", "")
        author_id = tweet.get("author_id", "")
        created_at = tweet.get("created_at", "")
        text = tweet.get("text", "")
        public_metrics = tweet.get("public_metrics", {})

        # Resolve author username from includes if available
        author_username = ""
        if includes:
            users = {u["id"]: u for u in includes.get("users", [])}
            user = users.get(author_id, {})
            author_username = user.get("username", "")

        return ContentItem(
            id=tweet_id,
            platform="x",
            content_type="post",
            title="",  # tweets don't have titles
            description=text[:500],
            url=f"https://x.com/i/status/{tweet_id}" if tweet_id else "",
            thumbnail_url="",
            author=author_username or author_id,
            author_url=f"https://x.com/{author_username}" if author_username else "",
            score=public_metrics.get("like_count"),
            comment_count=public_metrics.get("reply_count"),
            published_at=created_at,
            metadata={
                "retweet_count": public_metrics.get("retweet_count"),
                "quote_count": public_metrics.get("quote_count"),
                "impression_count": public_metrics.get("impression_count"),
                "lang": tweet.get("lang", ""),
            },
        )

    @staticmethod
    def _mock_feed() -> list[ContentItem]:
        """Return placeholder data when no API key is configured."""
        now = datetime.utcnow().isoformat()
        note = "Stub data -- set X_BEARER_TOKEN to fetch live tweets."
        return [
            ContentItem(
                id="mock-x-1",
                platform="x",
                content_type="post",
                title="",
                description="This is a placeholder tweet. Configure X_BEARER_TOKEN for live data.",
                url="https://x.com",
                author="wired_in_bot",
                author_url="https://x.com/wired_in_bot",
                score=0,
                comment_count=0,
                published_at=now,
                metadata={"mock": True, "note": note},
            ),
        ]

    # ----- public interface --------------------------------------------------

    def fetch_feed(self, config: dict) -> list[ContentItem]:
        """Fetch tweets from X.

        Config keys:
            query (str): Search query (required for search endpoint).
            user (str): Username to fetch timeline for.
            list_id (str): X list ID to fetch tweets from.
            max_results (int): 10-100. Default 10.
            api_key (str): Per-request bearer token from gateway.
        """
        token = self._resolve_token(config)
        if not token:
            logger.warning("X worker: no bearer token configured, returning mock data.")
            return self._mock_feed()

        query: str = config.get("query", "")
        user: str = config.get("user", "")
        max_results: int = min(max(int(config.get("max_results", 10)), 10), 100)

        tweet_fields = "id,text,author_id,created_at,public_metrics,lang"
        expansions = "author_id"
        user_fields = "username"

        session = self._get_session(config)

        # ---- user timeline ----
        if user:
            try:
                # First resolve username -> user id
                user_resp = session.get(
                    f"{_API_BASE}/users/by/username/{user}",
                    timeout=_REQUEST_TIMEOUT,
                )
                user_resp.raise_for_status()
                user_id = user_resp.json().get("data", {}).get("id")
                if not user_id:
                    logger.error("Could not resolve X user '%s'", user)
                    return []

                resp = session.get(
                    f"{_API_BASE}/users/{user_id}/tweets",
                    params={
                        "max_results": max_results,
                        "tweet.fields": tweet_fields,
                        "expansions": expansions,
                        "user.fields": user_fields,
                    },
                    timeout=_REQUEST_TIMEOUT,
                )
                resp.raise_for_status()
                payload = resp.json()
                includes = payload.get("includes")
                return [
                    self._tweet_to_content_item(t, includes)
                    for t in payload.get("data", [])
                ]
            except requests.RequestException as exc:
                logger.error("X user timeline fetch failed: %s", exc)
                return []

        # ---- search (default) ----
        if query:
            return self.search(query, max_results=max_results)

        logger.warning("X fetch_feed: provide either 'query' or 'user' in config.")
        return []

    def search(self, query: str, **kwargs) -> list[ContentItem]:
        """Search recent tweets matching *query*.

        Keyword args:
            max_results (int): 10-100. Default 10.
            api_key (str): Per-request bearer token from gateway.
        """
        token = kwargs.get("api_key") or self._bearer_token
        if not token:
            logger.warning("X search requires a bearer token; returning mock data.")
            return self._mock_feed()

        max_results = min(max(int(kwargs.get("max_results", 10)), 10), 100)

        params = {
            "query": query,
            "max_results": max_results,
            "tweet.fields": "id,text,author_id,created_at,public_metrics,lang",
            "expansions": "author_id",
            "user.fields": "username",
        }

        session = self._session
        if token and token != self._bearer_token:
            session = requests.Session()
            session.headers.update({"Authorization": f"Bearer {token}"})

        try:
            resp = session.get(
                f"{_API_BASE}/tweets/search/recent",
                params=params,
                timeout=_REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            payload = resp.json()
            includes = payload.get("includes")
            return [
                self._tweet_to_content_item(t, includes)
                for t in payload.get("data", [])
            ]
        except requests.RequestException as exc:
            logger.error("X search failed for '%s': %s", query, exc)
            return []

    def health_check(self) -> dict:
        base = super().health_check()
        base["bearer_token_configured"] = self._has_token
        return base
