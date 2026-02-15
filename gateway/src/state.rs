use redis::aio::ConnectionManager;
use sqlx::PgPool;

/// Shared application state available to all request handlers via `web::Data`.
#[derive(Clone)]
pub struct AppState {
    /// HTTP client for proxying requests to downstream services.
    pub http_client: reqwest::Client,

    /// Base URL for the aggregator service (e.g. `http://aggregator:4000`).
    pub aggregator_url: String,

    /// Base URL for the workers service (e.g. `http://workers:8000`).
    pub workers_url: String,

    /// PostgreSQL connection pool.
    pub db: PgPool,

    /// Redis connection manager.
    pub redis: ConnectionManager,
}

impl AppState {
    /// Build `AppState` from environment variables with sensible defaults.
    pub async fn from_env() -> Self {
        let aggregator_url = std::env::var("AGGREGATOR_URL")
            .unwrap_or_else(|_| "http://localhost:4000".to_string());
        let workers_url =
            std::env::var("WORKERS_URL").unwrap_or_else(|_| "http://localhost:8000".to_string());

        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/wiredin".to_string());
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379".to_string());

        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("failed to build reqwest client");

        let db = crate::db::init_pool(&database_url).await;
        let redis = crate::cache::init_redis(&redis_url).await;

        Self {
            http_client,
            aggregator_url,
            workers_url,
            db,
            redis,
        }
    }

    /// Build `AppState` with in-memory fallbacks (for unit tests without DB/Redis).
    #[cfg(test)]
    pub fn new_test(db: PgPool, redis: ConnectionManager) -> Self {
        let aggregator_url = std::env::var("AGGREGATOR_URL")
            .unwrap_or_else(|_| "http://localhost:4000".to_string());
        let workers_url =
            std::env::var("WORKERS_URL").unwrap_or_else(|_| "http://localhost:8000".to_string());

        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("failed to build reqwest client");

        Self {
            http_client,
            aggregator_url,
            workers_url,
            db,
            redis,
        }
    }
}
