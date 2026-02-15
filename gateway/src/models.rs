use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workspace {
    pub id: Uuid,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub tiles: Vec<Tile>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

// ---------------------------------------------------------------------------
// Tile
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tile {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub platform: Platform,
    pub config: TileConfig,
    pub position: TilePosition,
    pub refresh_interval_secs: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateTileRequest {
    pub platform: Platform,
    #[serde(default)]
    pub config: TileConfig,
    pub position: TilePosition,
    #[serde(default = "default_refresh_interval")]
    pub refresh_interval_secs: u64,
}

fn default_refresh_interval() -> u64 {
    60
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateTileRequest {
    pub config: Option<TileConfig>,
    pub position: Option<TilePosition>,
    pub refresh_interval_secs: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TilePosition {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// Platform-specific configuration stored as a flexible JSON value so each
/// platform (reddit, youtube, x, rss, news) can carry its own fields such as
/// `subreddit`, `channel`, `query`, `feed_url`, etc.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TileConfig {
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Reddit,
    Youtube,
    X,
    Rss,
    News,
}

// ---------------------------------------------------------------------------
// SSE content events
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContentEvent {
    pub platform: String,
    pub content_type: String,
    pub data: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Generic API responses
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(msg.into()),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubscribeRequest {
    pub callback_url: Option<String>,
}
