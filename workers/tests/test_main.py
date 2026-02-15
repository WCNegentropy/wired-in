"""Tests for the Wired-In Workers service.

Covers the app factory, health check, root endpoint, feed routes,
platform listing, and individual worker unit behaviour.
"""

import json
from unittest.mock import patch, MagicMock

import pytest

from main import create_app
from workers.base import ContentItem, PlatformWorker
from workers.reddit_worker import RedditWorker
from workers.youtube_worker import YouTubeWorker
from workers.x_worker import XWorker
from workers.rss_worker import RSSWorker
from workers.news_worker import NewsWorker
from workers.registry import WorkerRegistry


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def app():
    """Create an application instance configured for testing."""
    application = create_app(testing=True)
    return application


@pytest.fixture
def client(app):
    """Flask test client."""
    with app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# App-level tests
# ---------------------------------------------------------------------------

class TestAppEndpoints:

    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "ok"
        assert data["service"] == "wired-in-workers"
        assert "timestamp" in data

    def test_root(self, client):
        response = client.get("/api")
        assert response.status_code == 200
        data = response.get_json()
        assert "message" in data
        assert data["version"] == "0.1.0"

    def test_404(self, client):
        response = client.get("/nonexistent")
        assert response.status_code == 404
        data = response.get_json()
        assert data["error"] == "Not found"

    def test_cors_headers(self, client):
        response = client.get("/health")
        assert "Access-Control-Allow-Origin" in response.headers


# ---------------------------------------------------------------------------
# Feed route tests
# ---------------------------------------------------------------------------

class TestFeedRoutes:

    def test_list_platforms(self, client):
        response = client.get("/api/feeds/platforms")
        assert response.status_code == 200
        data = response.get_json()
        assert "platforms" in data
        platforms = data["platforms"]
        assert "reddit" in platforms
        assert "youtube" in platforms
        assert "x" in platforms
        assert "rss" in platforms
        assert "news" in platforms

    def test_unknown_platform_returns_404(self, client):
        response = client.get("/api/feeds/fakebook")
        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data
        assert "available" in data

    def test_search_missing_query_returns_400(self, client):
        response = client.get("/api/feeds/reddit/search")
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data

    @patch("workers.reddit_worker.RedditWorker.fetch_feed")
    def test_reddit_feed_endpoint(self, mock_fetch, client):
        mock_fetch.return_value = [
            ContentItem(
                id="t3_abc",
                platform="reddit",
                content_type="post",
                title="Test Post",
            )
        ]
        response = client.get("/api/feeds/reddit?subreddit=python&limit=5")
        assert response.status_code == 200
        data = response.get_json()
        assert data["platform"] == "reddit"
        assert data["count"] == 1
        assert data["items"][0]["title"] == "Test Post"

    @patch("workers.reddit_worker.RedditWorker.search")
    def test_reddit_search_endpoint(self, mock_search, client):
        mock_search.return_value = [
            ContentItem(id="t3_xyz", platform="reddit", title="Found Post")
        ]
        response = client.get("/api/feeds/reddit/search?q=flask")
        assert response.status_code == 200
        data = response.get_json()
        assert data["query"] == "flask"
        assert data["count"] == 1

    def test_search_unknown_platform_returns_404(self, client):
        response = client.get("/api/feeds/noplatform/search?q=test")
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# ContentItem tests
# ---------------------------------------------------------------------------

class TestContentItem:

    def test_default_fields(self):
        item = ContentItem()
        assert item.platform == ""
        assert item.content_type == ""
        assert item.id  # uuid generated
        assert item.fetched_at  # timestamp generated

    def test_to_dict(self):
        item = ContentItem(platform="reddit", title="Hello")
        d = item.to_dict()
        assert isinstance(d, dict)
        assert d["platform"] == "reddit"
        assert d["title"] == "Hello"

    def test_metadata_isolation(self):
        a = ContentItem()
        b = ContentItem()
        a.metadata["key"] = "value"
        assert "key" not in b.metadata


# ---------------------------------------------------------------------------
# Worker registry tests
# ---------------------------------------------------------------------------

class TestWorkerRegistry:

    def test_register_and_get(self):
        reg = WorkerRegistry()
        worker = RedditWorker()
        reg.register(worker)
        assert reg.get_worker("reddit") is worker

    def test_get_unknown_returns_none(self):
        reg = WorkerRegistry()
        assert reg.get_worker("doesnotexist") is None

    def test_list_platforms(self):
        reg = WorkerRegistry()
        reg.register(RedditWorker())
        reg.register(RSSWorker())
        platforms = reg.list_platforms()
        assert platforms == ["reddit", "rss"]

    def test_health_check_all(self):
        reg = WorkerRegistry()
        reg.register(RedditWorker())
        reg.register(RSSWorker())
        health = reg.health_check_all()
        assert len(health) == 2
        assert all(h["status"] == "ok" for h in health)


# ---------------------------------------------------------------------------
# Individual worker unit tests
# ---------------------------------------------------------------------------

class TestRedditWorker:

    def test_platform_name(self):
        w = RedditWorker()
        assert w.platform_name == "reddit"

    def test_health_check(self):
        w = RedditWorker()
        h = w.health_check()
        assert h["platform"] == "reddit"
        assert h["status"] == "ok"

    @patch("workers.reddit_worker.RedditWorker._get_json")
    def test_fetch_feed_parses_posts(self, mock_json):
        mock_json.return_value = {
            "data": {
                "children": [
                    {
                        "data": {
                            "name": "t3_test1",
                            "title": "Test Title",
                            "selftext": "Body text",
                            "permalink": "/r/test/comments/test1/test_title/",
                            "author": "tester",
                            "score": 42,
                            "num_comments": 10,
                            "created_utc": 1700000000,
                            "subreddit": "test",
                            "thumbnail": "default",
                            "is_self": True,
                            "domain": "self.test",
                            "upvote_ratio": 0.95,
                            "link_flair_text": None,
                        }
                    }
                ]
            }
        }
        w = RedditWorker()
        items = w.fetch_feed({"subreddit": "test", "limit": "1"})
        assert len(items) == 1
        assert items[0].title == "Test Title"
        assert items[0].platform == "reddit"
        assert items[0].score == 42

    @patch("workers.reddit_worker.RedditWorker._get_json")
    def test_fetch_feed_handles_error(self, mock_json):
        import requests as req
        mock_json.side_effect = req.RequestException("timeout")
        w = RedditWorker()
        items = w.fetch_feed({"subreddit": "test"})
        assert items == []


class TestYouTubeWorker:

    def test_platform_name(self):
        w = YouTubeWorker()
        assert w.platform_name == "youtube"

    def test_health_check_no_key(self):
        w = YouTubeWorker()
        w._api_key = None
        h = w.health_check()
        assert h["api_key_configured"] is False

    def test_fetch_feed_no_key_no_channel_returns_empty(self):
        w = YouTubeWorker()
        w._api_key = None
        items = w.fetch_feed({})
        assert items == []


class TestXWorker:

    def test_platform_name(self):
        w = XWorker()
        assert w.platform_name == "x"

    def test_mock_feed_when_no_token(self):
        w = XWorker()
        w._bearer_token = None
        items = w.fetch_feed({"query": "test"})
        assert len(items) == 1
        assert items[0].metadata.get("mock") is True

    def test_health_check(self):
        w = XWorker()
        w._bearer_token = None
        h = w.health_check()
        assert h["bearer_token_configured"] is False


class TestRSSWorker:

    def test_platform_name(self):
        w = RSSWorker()
        assert w.platform_name == "rss"

    def test_fetch_feed_no_url_returns_empty(self):
        w = RSSWorker()
        items = w.fetch_feed({})
        assert items == []

    def test_search_returns_empty(self):
        w = RSSWorker()
        items = w.search("anything")
        assert items == []


class TestNewsWorker:

    def test_platform_name(self):
        w = NewsWorker()
        assert w.platform_name == "news"

    def test_health_check_no_key(self):
        w = NewsWorker()
        w._api_key = None
        h = w.health_check()
        assert h["api_key_configured"] is False
        assert h["fallback"] == "google_news_rss"
