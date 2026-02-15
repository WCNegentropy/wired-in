"""YouTube platform worker.

Supports two modes:
  1. YouTube Data API v3 (requires YOUTUBE_API_KEY env var) -- full search and
     channel listing capabilities.
  2. YouTube RSS feed fallback (no key needed) -- limited to the most recent
     uploads for a given channel_id.
"""

import logging
import os
from datetime import datetime
from typing import Optional
from xml.etree import ElementTree

import requests

from workers.base import ContentItem, PlatformWorker

logger = logging.getLogger(__name__)

_API_BASE = "https://www.googleapis.com/youtube/v3"
_RSS_BASE = "https://www.youtube.com/feeds/videos.xml"
_REQUEST_TIMEOUT = 15


class YouTubeWorker(PlatformWorker):
    """Adapter for YouTube content via Data API v3 or RSS fallback."""

    platform_name: str = "youtube"

    def __init__(self) -> None:
        self._api_key: Optional[str] = os.getenv("YOUTUBE_API_KEY")
        self._session = requests.Session()

    # ----- helpers -----------------------------------------------------------

    def _resolve_api_key(self, config: dict) -> Optional[str]:
        """Return the API key from config (per-request header) or fall back to env var."""
        return config.get("api_key") or self._api_key

    @property
    def _has_api_key(self) -> bool:
        return bool(self._api_key)

    def _api_item_to_content(self, item: dict) -> ContentItem:
        """Convert a YouTube Data API search/video result to ContentItem."""
        snippet = item.get("snippet", {})

        # id can be a string (video resource) or dict (search result)
        id_obj = item.get("id", {})
        if isinstance(id_obj, dict):
            video_id = id_obj.get("videoId", "")
        else:
            video_id = str(id_obj)

        thumbnails = snippet.get("thumbnails", {})
        thumb = (
            thumbnails.get("high", {}).get("url")
            or thumbnails.get("medium", {}).get("url")
            or thumbnails.get("default", {}).get("url", "")
        )

        published = snippet.get("publishedAt", "")

        return ContentItem(
            id=video_id,
            platform="youtube",
            content_type="video",
            title=snippet.get("title", ""),
            description=snippet.get("description", "")[:500],
            url=f"https://www.youtube.com/watch?v={video_id}" if video_id else "",
            thumbnail_url=thumb,
            author=snippet.get("channelTitle", ""),
            author_url=(
                f"https://www.youtube.com/channel/{snippet.get('channelId', '')}"
                if snippet.get("channelId")
                else ""
            ),
            published_at=published,
            metadata={
                "channel_id": snippet.get("channelId", ""),
                "live_broadcast": snippet.get("liveBroadcastContent", ""),
            },
        )

    def _rss_entry_to_content(self, entry: ElementTree.Element, ns: dict) -> ContentItem:
        """Convert a single <entry> element from YouTube RSS into ContentItem."""
        title_el = entry.find("atom:title", ns)
        link_el = entry.find("atom:link", ns)
        author_el = entry.find("atom:author/atom:name", ns)
        published_el = entry.find("atom:published", ns)
        video_id_el = entry.find("yt:videoId", ns)
        media_group = entry.find("media:group", ns)

        description = ""
        thumbnail = ""
        if media_group is not None:
            desc_el = media_group.find("media:description", ns)
            description = (desc_el.text or "")[:500] if desc_el is not None else ""
            thumb_el = media_group.find("media:thumbnail", ns)
            thumbnail = thumb_el.get("url", "") if thumb_el is not None else ""

        video_id = video_id_el.text if video_id_el is not None else ""

        return ContentItem(
            id=video_id,
            platform="youtube",
            content_type="video",
            title=title_el.text if title_el is not None else "",
            description=description,
            url=link_el.get("href", "") if link_el is not None else "",
            thumbnail_url=thumbnail,
            author=author_el.text if author_el is not None else "",
            author_url="",
            published_at=published_el.text if published_el is not None else "",
            metadata={"source": "rss_fallback"},
        )

    def _fetch_via_rss(self, channel_id: str, max_results: int = 15) -> list[ContentItem]:
        """Fallback: fetch latest uploads via YouTube's public RSS feed."""
        url = f"{_RSS_BASE}?channel_id={channel_id}"
        try:
            resp = self._session.get(url, timeout=_REQUEST_TIMEOUT)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.error("YouTube RSS fetch failed for channel %s: %s", channel_id, exc)
            return []

        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "yt": "http://www.youtube.com/xml/schemas/2015",
            "media": "http://search.yahoo.com/mrss/",
        }

        try:
            root = ElementTree.fromstring(resp.text)
        except ElementTree.ParseError as exc:
            logger.error("YouTube RSS parse error: %s", exc)
            return []

        entries = root.findall("atom:entry", ns)[:max_results]
        return [self._rss_entry_to_content(e, ns) for e in entries]

    # ----- public interface --------------------------------------------------

    def fetch_feed(self, config: dict) -> list[ContentItem]:
        """Fetch YouTube videos.

        Config keys:
            channel_id (str): YouTube channel ID.
            query (str): Search query (API mode only).
            max_results (int): Number of results. Default 15.
            order (str): date, rating, relevance, title, viewCount. Default "date".
        """
        channel_id: str = config.get("channel_id", "")
        query: str = config.get("query", "")
        max_results: int = min(int(config.get("max_results", 15)), 50)
        order: str = config.get("order", "date")

        # ---- API mode ----
        resolved_key = self._resolve_api_key(config)
        if resolved_key:
            params: dict = {
                "part": "snippet",
                "maxResults": max_results,
                "order": order,
                "type": "video",
                "key": resolved_key,
            }
            if channel_id:
                params["channelId"] = channel_id
            if query:
                params["q"] = query

            try:
                resp = self._session.get(
                    f"{_API_BASE}/search", params=params, timeout=_REQUEST_TIMEOUT
                )
                resp.raise_for_status()
                data = resp.json()
                items = data.get("items", [])
                return [self._api_item_to_content(item) for item in items]
            except requests.RequestException as exc:
                logger.error("YouTube API search failed: %s", exc)
                return []

        # ---- RSS fallback (needs channel_id) ----
        if channel_id:
            return self._fetch_via_rss(channel_id, max_results)

        logger.warning(
            "YouTube worker: no API key and no channel_id provided. "
            "Configure YOUTUBE_API_KEY, add an API key in settings, or supply a channel_id for RSS fallback."
        )
        return []

    def search(self, query: str, **kwargs) -> list[ContentItem]:
        """Search YouTube for videos matching *query*.

        Keyword args:
            max_results (int): Max results. Default 15.
            order (str): Sorting. Default "relevance".
            api_key (str): Per-request API key from gateway.
        """
        resolved_key = kwargs.get("api_key") or self._api_key
        if not resolved_key:
            logger.warning("YouTube search requires an API key; returning empty results.")
            return []

        max_results = min(int(kwargs.get("max_results", 15)), 50)
        order = kwargs.get("order", "relevance")

        params = {
            "part": "snippet",
            "q": query,
            "maxResults": max_results,
            "order": order,
            "type": "video",
            "key": resolved_key,
        }

        try:
            resp = self._session.get(
                f"{_API_BASE}/search", params=params, timeout=_REQUEST_TIMEOUT
            )
            resp.raise_for_status()
            data = resp.json()
            return [self._api_item_to_content(item) for item in data.get("items", [])]
        except requests.RequestException as exc:
            logger.error("YouTube search failed for '%s': %s", query, exc)
            return []

    def health_check(self) -> dict:
        base = super().health_check()
        base["api_key_configured"] = self._has_api_key
        return base
