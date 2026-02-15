use actix_web::{delete, get, post, put, web, HttpResponse};
use log::info;
use sqlx::Row;
use uuid::Uuid;

use crate::models::{
    ApiResponse, CreateTileRequest, Platform, Tile, TileConfig, TilePosition, UpdateTileRequest,
};
use crate::state::AppState;

/// GET /api/workspaces/{workspace_id}/tiles
#[get("/workspaces/{workspace_id}/tiles")]
pub async fn list_tiles(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let workspace_id = path.into_inner();

    let rows = sqlx::query(
        "SELECT id, workspace_id, platform, config, position_x, position_y, position_w, position_h, refresh_interval_secs FROM tiles WHERE workspace_id = $1 ORDER BY created_at",
    )
    .bind(workspace_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let tiles: Vec<Tile> = rows.iter().filter_map(|r| tile_from_row(r).ok()).collect();
            info!("Listing {} tiles for workspace {}", tiles.len(), workspace_id);
            HttpResponse::Ok().json(ApiResponse::ok(tiles))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// POST /api/workspaces/{workspace_id}/tiles
#[post("/workspaces/{workspace_id}/tiles")]
pub async fn create_tile(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    body: web::Json<CreateTileRequest>,
) -> HttpResponse {
    let workspace_id = path.into_inner();

    // Verify the workspace exists.
    let ws_exists: Result<Option<bool>, _> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = $1)",
    )
    .bind(workspace_id)
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

    let id = Uuid::new_v4();
    let platform_str = serde_json::to_value(&body.platform)
        .ok()
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "reddit".to_string());
    let config_json = serde_json::to_value(&body.config.extra).unwrap_or_default();

    let result = sqlx::query(
        "INSERT INTO tiles (id, workspace_id, platform, config, position_x, position_y, position_w, position_h, refresh_interval_secs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(id)
    .bind(workspace_id)
    .bind(&platform_str)
    .bind(&config_json)
    .bind(body.position.x)
    .bind(body.position.y)
    .bind(body.position.w)
    .bind(body.position.h)
    .bind(body.refresh_interval_secs as i64)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            let tile = Tile {
                id,
                workspace_id,
                platform: body.platform.clone(),
                config: body.config.clone(),
                position: body.position.clone(),
                refresh_interval_secs: body.refresh_interval_secs,
            };

            info!(
                "Creating tile {} in workspace {} for platform {:?}",
                tile.id, workspace_id, tile.platform
            );
            HttpResponse::Created().json(ApiResponse::ok(tile))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// PUT /api/tiles/{id}
#[put("/tiles/{id}")]
pub async fn update_tile(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateTileRequest>,
) -> HttpResponse {
    let id = path.into_inner();

    // Fetch current tile
    let existing = sqlx::query(
        "SELECT id, workspace_id, platform, config, position_x, position_y, position_w, position_h, refresh_interval_secs FROM tiles WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match existing {
        Ok(Some(row)) => {
            let old_config: serde_json::Value = row.get("config");
            let old_pos_x: i32 = row.get("position_x");
            let old_pos_y: i32 = row.get("position_y");
            let old_pos_w: i32 = row.get("position_w");
            let old_pos_h: i32 = row.get("position_h");
            let old_interval: i64 = row.get("refresh_interval_secs");

            let new_config = body.config.as_ref()
                .map(|c| serde_json::to_value(&c.extra).unwrap_or_default())
                .unwrap_or(old_config);
            let new_pos_x = body.position.as_ref().map(|p| p.x).unwrap_or(old_pos_x);
            let new_pos_y = body.position.as_ref().map(|p| p.y).unwrap_or(old_pos_y);
            let new_pos_w = body.position.as_ref().map(|p| p.w).unwrap_or(old_pos_w);
            let new_pos_h = body.position.as_ref().map(|p| p.h).unwrap_or(old_pos_h);
            let new_interval = body.refresh_interval_secs
                .map(|i| i as i64)
                .unwrap_or(old_interval);

            let result = sqlx::query(
                "UPDATE tiles SET config = $2, position_x = $3, position_y = $4, position_w = $5, position_h = $6, refresh_interval_secs = $7 WHERE id = $1 RETURNING id, workspace_id, platform, config, position_x, position_y, position_w, position_h, refresh_interval_secs",
            )
            .bind(id)
            .bind(&new_config)
            .bind(new_pos_x)
            .bind(new_pos_y)
            .bind(new_pos_w)
            .bind(new_pos_h)
            .bind(new_interval)
            .fetch_optional(&state.db)
            .await;

            match result {
                Ok(Some(updated_row)) => {
                    match tile_from_row(&updated_row) {
                        Ok(tile) => {
                            info!("Updated tile {}", id);
                            HttpResponse::Ok().json(ApiResponse::ok(tile))
                        }
                        Err(e) => HttpResponse::InternalServerError()
                            .json(ApiResponse::<()>::err(e)),
                    }
                }
                Ok(None) => HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err("Update failed")),
                Err(e) => HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
            }
        }
        Ok(None) => {
            HttpResponse::NotFound().json(ApiResponse::<()>::err(format!("Tile {id} not found")))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// DELETE /api/tiles/{id}
#[delete("/tiles/{id}")]
pub async fn delete_tile(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();
    let result = sqlx::query("DELETE FROM tiles WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            info!("Deleted tile {}", id);
            HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({ "deleted": id })))
        }
        Ok(_) => {
            HttpResponse::NotFound().json(ApiResponse::<()>::err(format!("Tile {id} not found")))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

// ── Helper to convert a sqlx Row into a Tile ──────────────────────

fn tile_from_row(row: &sqlx::postgres::PgRow) -> Result<Tile, String> {
    let platform_str: String = row.get("platform");
    let platform: Platform =
        serde_json::from_value(serde_json::Value::String(platform_str.clone()))
            .map_err(|_| format!("Unknown platform: {}", platform_str))?;

    Ok(Tile {
        id: row.get("id"),
        workspace_id: row.get("workspace_id"),
        platform,
        config: TileConfig {
            extra: row.get("config"),
        },
        position: TilePosition {
            x: row.get("position_x"),
            y: row.get("position_y"),
            w: row.get("position_w"),
            h: row.get("position_h"),
        },
        refresh_interval_secs: row.get::<i64, _>("refresh_interval_secs") as u64,
    })
}
