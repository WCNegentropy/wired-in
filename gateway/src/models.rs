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
// Batch tile position update
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchTilePositionRequest {
    pub positions: Vec<TilePositionEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TilePositionEntry {
    pub tile_id: Uuid,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
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

#[derive(Debug, Serialize)]
pub struct AggregatedHealthResponse {
    pub gateway: String,
    pub aggregator: String,
    pub workers: String,
    pub db: String,
    pub redis: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubscribeRequest {
    pub callback_url: Option<String>,
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub id: Uuid,
    pub email: String,
    pub name: Option<String>,
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateApiKeyRequest {
    pub platform: String,
    #[serde(default = "default_key_name")]
    pub key_name: String,
    pub key_value: String,
    pub key_secret: Option<String>,
}

fn default_key_name() -> String {
    "default".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateApiKeyRequest {
    pub key_value: Option<String>,
    pub key_secret: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiKeyResponse {
    pub id: Uuid,
    pub platform: String,
    pub key_name: String,
    pub key_value_masked: String,
    pub has_secret: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserPreferences {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_refresh")]
    pub default_refresh_interval: u64,
    #[serde(default = "default_true")]
    pub notifications_enabled: bool,
    #[serde(default)]
    pub compact_mode: bool,
}

fn default_theme() -> String {
    "dark".to_string()
}
fn default_refresh() -> u64 {
    300
}
fn default_true() -> bool {
    true
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            default_refresh_interval: default_refresh(),
            notifications_enabled: default_true(),
            compact_mode: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateBookmarkRequest {
    pub content_id: String,
    pub platform: String,
    pub title: String,
    pub url: String,
    #[serde(default)]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateBookmarkRequest {
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookmarkResponse {
    pub id: Uuid,
    pub content_id: String,
    pub platform: String,
    pub title: String,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub author: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthCallbackRequest {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthUrlResponse {
    pub url: String,
}

// ---------------------------------------------------------------------------
// Workspace Shares
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateShareRequest {
    #[serde(default = "default_permission")]
    pub permission: String,
    #[serde(default)]
    pub expires_in_hours: Option<i64>,
}

fn default_permission() -> String {
    "view".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShareResponse {
    pub id: Uuid,
    pub share_token: String,
    pub permission: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShareLinkResponse {
    pub share_url: String,
    pub token: String,
    pub permission: String,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SharedWorkspaceResponse {
    pub workspace: Workspace,
    pub owner: String,
}

// ---------------------------------------------------------------------------
// Saved Searches (Track A)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateSavedSearchRequest {
    pub name: String,
    pub query: String,
    #[serde(default)]
    pub platforms: Vec<String>,
    #[serde(default = "default_true")]
    pub notify: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateSavedSearchRequest {
    pub name: Option<String>,
    pub query: Option<String>,
    pub platforms: Option<Vec<String>>,
    pub notify: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedSearchResponse {
    pub id: Uuid,
    pub name: String,
    pub query: String,
    pub platforms: Vec<String>,
    pub notify: bool,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Content Analytics (Track B)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackClickRequest {
    pub workspace_id: Uuid,
    pub tile_id: Option<Uuid>,
    pub content_id: String,
    pub platform: String,
    pub title: Option<String>,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlatformCount {
    pub platform: String,
    pub count: i64,
    pub percentage: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TopContentItem {
    pub content_id: String,
    pub title: Option<String>,
    pub url: String,
    pub platform: String,
    pub click_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyClickCount {
    pub day: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceAnalytics {
    pub workspace_id: Uuid,
    pub total_clicks: i64,
    pub platform_breakdown: Vec<PlatformCount>,
    pub top_content: Vec<TopContentItem>,
    pub daily_clicks: Vec<DailyClickCount>,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Import/Export (Track D)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportedWorkspace {
    pub name: String,
    pub description: Option<String>,
    pub tiles: Vec<ExportedTile>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportedTile {
    pub platform: Platform,
    pub config: TileConfig,
    pub position: TilePosition,
    pub refresh_interval_secs: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceExport {
    pub version: String,
    pub exported_at: DateTime<Utc>,
    pub workspaces: Vec<ExportedWorkspace>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportResult {
    pub workspace_ids: Vec<Uuid>,
    pub workspace_count: usize,
    pub tile_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpmlImportResult {
    pub workspace_id: Uuid,
    pub workspace_name: String,
    pub tile_count: usize,
}
