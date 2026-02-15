"""Base classes for all platform workers.

Defines the ContentItem dataclass and the abstract PlatformWorker interface
that every platform adapter must implement.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional
import uuid


@dataclass
class ContentItem:
    """Normalized content item shared across all platform workers."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    platform: str = ""
    content_type: str = ""  # article, video, post, comment
    title: str = ""
    description: str = ""
    url: str = ""
    thumbnail_url: str = ""
    author: str = ""
    author_url: str = ""
    score: Optional[int] = None
    comment_count: Optional[int] = None
    published_at: str = ""
    fetched_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Serialize the content item to a plain dictionary."""
        return asdict(self)


class PlatformWorker(ABC):
    """Abstract base class that every platform adapter must extend."""

    platform_name: str = ""

    @abstractmethod
    def fetch_feed(self, config: dict) -> list[ContentItem]:
        """Fetch content based on configuration.

        Args:
            config: Platform-specific configuration dict (e.g. subreddit,
                     channel_id, feed_url, query, etc.)

        Returns:
            List of normalised ContentItem objects.
        """
        pass

    @abstractmethod
    def search(self, query: str, **kwargs) -> list[ContentItem]:
        """Search for content on this platform.

        Args:
            query: Free-text search string.
            **kwargs: Additional platform-specific search parameters.

        Returns:
            List of matching ContentItem objects.
        """
        pass

    def health_check(self) -> dict:
        """Return a simple health status for this worker."""
        return {"platform": self.platform_name, "status": "ok"}
