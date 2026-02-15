"""Wired-In Platform Workers Service.

Flask application that provides unified API adapters for multiple content
platforms: Reddit, YouTube, X/Twitter, RSS feeds, and News APIs.
"""

import os
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify

load_dotenv()


def create_app(testing: bool = False) -> Flask:
    """Application factory for the Wired-In Workers service."""
    app = Flask(__name__)

    app.config["TESTING"] = testing

    # ---- CORS support (simple implementation, no extra dependency) ----
    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = os.getenv(
            "CORS_ORIGIN", "*"
        )
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    # ---- Health check ----
    @app.route("/health")
    def health_check():
        """Health check endpoint."""
        return jsonify({
            "status": "ok",
            "service": "wired-in-workers",
            "timestamp": datetime.utcnow().isoformat(),
        })

    # ---- Root ----
    @app.route("/api")
    def root():
        """Root API endpoint."""
        return jsonify({
            "message": "Welcome to wired-in-workers API",
            "version": "0.1.0",
            "docs": "/api/feeds/platforms",
        })

    # ---- Register blueprints ----
    from routes.feeds import feeds_bp  # noqa: E402

    app.register_blueprint(feeds_bp)

    # ---- Error handlers ----
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Not found", "status": 404}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"error": "Internal server error", "status": 500}), 500

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": "Bad request", "status": 400}), 400

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
