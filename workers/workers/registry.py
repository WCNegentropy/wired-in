"""Worker registry -- single point of access for all platform adapters.

Import ``registry`` from this module to get the pre-populated global
WorkerRegistry instance.
"""

from __future__ import annotations

from workers.base import PlatformWorker
from workers.reddit_worker import RedditWorker
from workers.youtube_worker import YouTubeWorker
from workers.x_worker import XWorker
from workers.rss_worker import RSSWorker
from workers.news_worker import NewsWorker


class WorkerRegistry:
    """Holds instantiated platform workers keyed by platform name."""

    def __init__(self) -> None:
        self._workers: dict[str, PlatformWorker] = {}

    def register(self, worker: PlatformWorker) -> None:
        """Register a worker instance under its ``platform_name``."""
        self._workers[worker.platform_name] = worker

    def get_worker(self, platform_name: str) -> PlatformWorker | None:
        """Return the worker for *platform_name*, or ``None`` if unknown."""
        return self._workers.get(platform_name)

    def list_platforms(self) -> list[str]:
        """Return a sorted list of registered platform names."""
        return sorted(self._workers.keys())

    def health_check_all(self) -> list[dict]:
        """Run health_check on every registered worker."""
        return [w.health_check() for w in self._workers.values()]


def _build_default_registry() -> WorkerRegistry:
    """Create and populate the default registry with all built-in workers."""
    reg = WorkerRegistry()
    reg.register(RedditWorker())
    reg.register(YouTubeWorker())
    reg.register(XWorker())
    reg.register(RSSWorker())
    reg.register(NewsWorker())
    return reg


# Global singleton -- import this wherever you need access to workers.
registry = _build_default_registry()
