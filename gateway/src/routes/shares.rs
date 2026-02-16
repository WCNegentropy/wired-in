use actix_web::{delete, get, post, web, HttpResponse};
use chrono::{Duration, Utc};
use log::info;
use rand::Rng;
use sqlx::Row;
use uuid::Uuid;

use crate::middleware::AuthenticatedUser;
use crate::models::{
    ApiResponse, CreateShareRequest, ShareLinkResponse, ShareResponse, SharedWorkspaceResponse,
    Workspace,
};
use crate::state::AppState;
use super::helpers::tile_from_row;

/// Generate a random 32-byte hex token for share links.
fn generate_share_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    hex::encode(bytes)
}

/// POST /api/workspaces/{id}/share
/// Create a share link for a workspace.
#[post("/workspaces/{id}/share")]
pub async fn create_share_link(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    body: web::Json<CreateShareRequest>,
) -> HttpResponse {
    let workspace_id = path.into_inner();

    // Verify workspace ownership
    let ws_exists: Result<Option<bool>, _> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = $1 AND user_id = $2)",
    )
    .bind(workspace_id)
    .bind(user.user_id)
    .fetch_optional(&state.db)
    .await;

    match ws_exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(ApiResponse::<()>::err(format!(
                "Workspace {workspace_id} not found"
            )));
        }
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err(format!("Database error: {e}")));
        }
        _ => {}
    }

    let token = generate_share_token();
    let id = Uuid::new_v4();
    let now = Utc::now();

    let expires_at = body.expires_in_hours.map(|hours| now + Duration::hours(hours));

    let result = sqlx::query(
        "INSERT INTO workspace_shares (id, workspace_id, share_token, permission, created_by, expires_at, created_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING id, share_token, permission, expires_at, created_at",
    )
    .bind(id)
    .bind(workspace_id)
    .bind(&token)
    .bind(&body.permission)
    .bind(user.user_id)
    .bind(expires_at)
    .bind(now)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(row) => {
            let share_token: String = row.get("share_token");
            let base_url = std::env::var("PUBLIC_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string());
            let share_url = format!("{base_url}/shared/{share_token}");

            info!(
                "Share link created for workspace {} by user {}",
                workspace_id, user.user_id
            );

            HttpResponse::Created().json(ApiResponse::ok(ShareLinkResponse {
                share_url,
                token: share_token,
                permission: row.get("permission"),
                expires_at: row.get("expires_at"),
            }))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// DELETE /api/workspaces/{id}/share/{shareId}
/// Revoke a share link.
#[delete("/workspaces/{id}/share/{share_id}")]
pub async fn revoke_share_link(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<(Uuid, Uuid)>,
) -> HttpResponse {
    let (workspace_id, share_id) = path.into_inner();

    let result = sqlx::query(
        "UPDATE workspace_shares SET is_active = false \
         WHERE id = $1 AND workspace_id = $2 AND created_by = $3 AND is_active = true",
    )
    .bind(share_id)
    .bind(workspace_id)
    .bind(user.user_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            info!("Share link {} revoked for workspace {}", share_id, workspace_id);
            HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({ "revoked": share_id })))
        }
        Ok(_) => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Share link {share_id} not found"))),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// GET /api/workspaces/{id}/shares
/// List active share links for a workspace.
#[get("/workspaces/{id}/shares")]
pub async fn list_share_links(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let workspace_id = path.into_inner();

    // Verify workspace ownership
    let ws_exists: Result<Option<bool>, _> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = $1 AND user_id = $2)",
    )
    .bind(workspace_id)
    .bind(user.user_id)
    .fetch_optional(&state.db)
    .await;

    match ws_exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(ApiResponse::<()>::err(format!(
                "Workspace {workspace_id} not found"
            )));
        }
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err(format!("Database error: {e}")));
        }
        _ => {}
    }

    let rows = sqlx::query(
        "SELECT id, share_token, permission, expires_at, created_at \
         FROM workspace_shares WHERE workspace_id = $1 AND is_active = true \
         ORDER BY created_at DESC",
    )
    .bind(workspace_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let shares: Vec<ShareResponse> = rows
                .iter()
                .map(|r| ShareResponse {
                    id: r.get("id"),
                    share_token: r.get("share_token"),
                    permission: r.get("permission"),
                    expires_at: r.get("expires_at"),
                    created_at: r.get("created_at"),
                })
                .collect();
            HttpResponse::Ok().json(ApiResponse::ok(shares))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// GET /api/shared/{token}
/// Public endpoint — no auth required. Load shared workspace data.
#[get("/shared/{token}")]
pub async fn get_shared_workspace(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let token = path.into_inner();

    // Look up the share link
    let share_row = sqlx::query(
        "SELECT workspace_id, permission, expires_at, is_active \
         FROM workspace_shares WHERE share_token = $1",
    )
    .bind(&token)
    .fetch_optional(&state.db)
    .await;

    match share_row {
        Ok(Some(row)) => {
            let is_active: bool = row.get("is_active");
            let expires_at: Option<chrono::DateTime<Utc>> = row.get("expires_at");
            let workspace_id: Uuid = row.get("workspace_id");

            // Check if the share is still valid
            if !is_active {
                return HttpResponse::NotFound()
                    .json(ApiResponse::<()>::err("Share link is no longer active"));
            }

            if let Some(exp) = expires_at {
                if exp < Utc::now() {
                    return HttpResponse::NotFound()
                        .json(ApiResponse::<()>::err("Share link has expired"));
                }
            }

            // Load workspace data
            let ws_row = sqlx::query(
                "SELECT w.id, w.name, w.description, w.created_at, w.updated_at, u.name AS owner_name \
                 FROM workspaces w \
                 JOIN users u ON w.user_id = u.id \
                 WHERE w.id = $1",
            )
            .bind(workspace_id)
            .fetch_optional(&state.db)
            .await;

            match ws_row {
                Ok(Some(ws)) => {
                    let owner_name: Option<String> = ws.get("owner_name");

                    let mut workspace = Workspace {
                        id: ws.get("id"),
                        name: ws.get("name"),
                        description: ws.get("description"),
                        tiles: Vec::new(),
                        created_at: ws.get("created_at"),
                        updated_at: ws.get("updated_at"),
                    };

                    // Load tiles
                    let tile_rows = sqlx::query(
                        "SELECT id, workspace_id, platform, config, position_x, position_y, position_w, position_h, refresh_interval_secs \
                         FROM tiles WHERE workspace_id = $1",
                    )
                    .bind(workspace_id)
                    .fetch_all(&state.db)
                    .await;

                    if let Ok(rows) = tile_rows {
                        workspace.tiles = rows
                            .iter()
                            .filter_map(|r| tile_from_row(r).ok())
                            .collect();
                    }

                    HttpResponse::Ok().json(ApiResponse::ok(SharedWorkspaceResponse {
                        workspace,
                        owner: owner_name.unwrap_or_else(|| "Anonymous".to_string()),
                    }))
                }
                Ok(None) => HttpResponse::NotFound()
                    .json(ApiResponse::<()>::err("Shared workspace not found")),
                Err(e) => HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
            }
        }
        Ok(None) => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err("Share link not found")),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}
