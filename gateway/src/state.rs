use std::sync::{Arc, Mutex};

use crate::models::{Tile, Workspace};

/// Shared application state available to all request handlers via `web::Data`.
#[derive(Clone)]
pub struct AppState {
    /// HTTP client for proxying requests to downstream services.
    pub http_client: reqwest::Client,

    /// Base URL for the aggregator service (e.g. `http://aggregator:4000`).
    pub aggregator_url: String,

    /// Base URL for the workers service (e.g. `http://workers:8000`).
    pub workers_url: String,

    /// In-memory workspace storage (will be replaced with Postgres later).
    pub workspaces: Arc<Mutex<Vec<Workspace>>>,

    /// In-memory tile storage.
    pub tiles: Arc<Mutex<Vec<Tile>>>,
}

impl AppState {
    /// Build `AppState` from environment variables with sensible defaults.
    pub fn from_env() -> Self {
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
            workspaces: Arc::new(Mutex::new(Vec::new())),
            tiles: Arc::new(Mutex::new(Vec::new())),
        }
    }
}
