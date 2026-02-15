"""Feed routes -- Flask Blueprint exposing platform worker endpoints.

All endpoints live under ``/api/feeds/``.
"""

import logging

from flask import Blueprint, jsonify, request

from workers.registry import registry

logger = logging.getLogger(__name__)

feeds_bp = Blueprint("feeds", __name__, url_prefix="/api/feeds")


def _inject_api_key(config: dict) -> dict:
    """If the gateway forwarded an API key via headers, inject it into config."""
    api_key = request.headers.get("X-Platform-Api-Key")
    api_secret = request.headers.get("X-Platform-Api-Secret")
    if api_key:
        config["api_key"] = api_key
    if api_secret:
        config["api_secret"] = api_secret
    return config


@feeds_bp.route("/platforms", methods=["GET"])
def list_platforms():
    """Return a list of available platform adapters and their health status."""
    platforms = registry.list_platforms()
    health = registry.health_check_all()
    return jsonify({
        "platforms": platforms,
        "health": health,
    })


@feeds_bp.route("/<platform>", methods=["GET"])
def fetch_feed(platform: str):
    """Fetch a feed from *platform*.

    All query-string parameters are forwarded as the worker config dict.
    For example::

        GET /api/feeds/reddit?subreddit=python&sort=top&limit=10
        GET /api/feeds/rss?feed_url=https://example.com/feed.xml
        GET /api/feeds/youtube?channel_id=UC...&max_results=5
        GET /api/feeds/news?query=AI&category=technology
        GET /api/feeds/x?query=python
    """
    worker = registry.get_worker(platform)
    if worker is None:
        return jsonify({
            "error": f"Unknown platform: {platform}",
            "available": registry.list_platforms(),
        }), 404

    config = dict(request.args)
    config = _inject_api_key(config)

    try:
        items = worker.fetch_feed(config)
        return jsonify({
            "platform": platform,
            "count": len(items),
            "items": [item.to_dict() for item in items],
        })
    except Exception as exc:
        logger.exception("Error fetching feed from %s", platform)
        return jsonify({
            "error": f"Failed to fetch feed from {platform}",
            "detail": str(exc),
        }), 500


@feeds_bp.route("/<platform>/search", methods=["GET"])
def search_platform(platform: str):
    """Search *platform* for content matching the ``q`` query parameter.

    Example::

        GET /api/feeds/reddit/search?q=flask+tutorial&limit=10
        GET /api/feeds/youtube/search?q=python+async
        GET /api/feeds/news/search?q=climate+change
    """
    worker = registry.get_worker(platform)
    if worker is None:
        return jsonify({
            "error": f"Unknown platform: {platform}",
            "available": registry.list_platforms(),
        }), 404

    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "Missing required query parameter: q"}), 400

    # Pass remaining query params as kwargs
    kwargs = {k: v for k, v in request.args.items() if k != "q"}

    # Inject API key from headers if present
    api_key = request.headers.get("X-Platform-Api-Key")
    api_secret = request.headers.get("X-Platform-Api-Secret")
    if api_key:
        kwargs["api_key"] = api_key
    if api_secret:
        kwargs["api_secret"] = api_secret

    try:
        items = worker.search(query, **kwargs)
        return jsonify({
            "platform": platform,
            "query": query,
            "count": len(items),
            "items": [item.to_dict() for item in items],
        })
    except Exception as exc:
        logger.exception("Error searching %s for '%s'", platform, query)
        return jsonify({
            "error": f"Search failed on {platform}",
            "detail": str(exc),
        }), 500
