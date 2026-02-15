"""RSS / Atom feed platform worker.

The most universal adapter -- works with any valid RSS or Atom feed URL.
Uses the *feedparser* library to handle both formats transparently.
"""

import logging
from datetime import datetime
from time import mktime
from typing import Optional

import feedparser

from workers.base import ContentItem, PlatformWorker

logger = logging.getLogger(__name__)


class RSSWorker(PlatformWorker):
    """Generic RSS / Atom feed adapter."""

    platform_name: str = "rss"

    # ----- helpers -----------------------------------------------------------

    @staticmethod
    def _entry_to_content_item(entry: feedparser.FeedParserDict, feed_title: str = "") -> ContentItem:
        """Map a single feedparser entry to a ContentItem."""
        # Published date -- feedparser gives us a time struct if available
        published = ""
        time_struct = entry.get("published_parsed") or entry.get("updated_parsed")
        if time_struct:
            try:
                published = datetime.utcfromtimestamp(mktime(time_struct)).isoformat()
            except (ValueError, OverflowError):
                published = entry.get("published", entry.get("updated", ""))

        # Thumbnail / image
        thumbnail = ""
        media_content: list = entry.get("media_content", [])
        if media_content:
            thumbnail = media_content[0].get("url", "")
        if not thumbnail:
            media_thumb: Optional[dict] = entry.get("media_thumbnail")
            if media_thumb and isinstance(media_thumb, list):
                thumbnail = media_thumb[0].get("url", "")

        # Description: prefer summary, strip to first 500 chars
        description = entry.get("summary", entry.get("description", ""))[:500]

        return ContentItem(
            id=entry.get("id", entry.get("link", "")),
            platform="rss",
            content_type="article",
            title=entry.get("title", ""),
            description=description,
            url=entry.get("link", ""),
            thumbnail_url=thumbnail,
            author=entry.get("author", ""),
            author_url="",
            published_at=published,
            metadata={
                "feed_title": feed_title,
                "tags": [t.get("term", "") for t in entry.get("tags", [])],
            },
        )

    # ----- public interface --------------------------------------------------

    def fetch_feed(self, config: dict) -> list[ContentItem]:
        """Parse an RSS or Atom feed.

        Config keys:
            feed_url (str): Full URL of the feed. **Required.**
            max_items (int): Maximum entries to return. Default 25.
        """
        feed_url: str = config.get("feed_url", "")
        if not feed_url:
            logger.error("RSS fetch_feed called without feed_url")
            return []

        max_items: int = int(config.get("max_items", 25))

        try:
            parsed = feedparser.parse(feed_url)
        except Exception as exc:
            logger.error("RSS parse error for %s: %s", feed_url, exc)
            return []

        if parsed.bozo and not parsed.entries:
            logger.warning("RSS feed %s is malformed: %s", feed_url, parsed.bozo_exception)
            return []

        feed_title = parsed.feed.get("title", "")
        entries = parsed.entries[:max_items]
        return [self._entry_to_content_item(e, feed_title) for e in entries]

    def search(self, query: str, **kwargs) -> list[ContentItem]:
        """RSS feeds don't support search -- returns an empty list with a note.

        Use fetch_feed with a specific feed_url instead.
        """
        logger.info("RSS search is not supported; use fetch_feed with a feed_url instead.")
        return []
