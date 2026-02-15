use actix_web::{delete, get, post, put, web, HttpResponse};
use chrono::Utc;
use log::info;
use sqlx::Row;
use uuid::Uuid;

use crate::models::{ApiResponse, CreateWorkspaceRequest, UpdateWorkspaceRequest, Workspace};
use crate::state::AppState;
use super::helpers::tile_from_row;

/// GET /api/workspaces
#[get("/workspaces")]
pub async fn list_workspaces(state: web::Data<AppState>) -> HttpResponse {
    let rows = sqlx::query(
        "SELECT id, name, description, created_at, updated_at FROM workspaces ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let workspaces: Vec<Workspace> = rows
                .iter()
                .map(|r| Workspace {
                    id: r.get("id"),
                    name: r.get("name"),
                    description: r.get("description"),
                    tiles: Vec::new(),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                })
                .collect();
            info!("Listing {} workspaces", workspaces.len());
            HttpResponse::Ok().json(ApiResponse::ok(workspaces))
        }
        Err(e) => {
            HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err(format!("Database error: {e}")))
        }
    }
}

/// POST /api/workspaces
#[post("/workspaces")]
pub async fn create_workspace(
    state: web::Data<AppState>,
    body: web::Json<CreateWorkspaceRequest>,
) -> HttpResponse {
    let id = Uuid::new_v4();
    let now = Utc::now();

    let result = sqlx::query(
        "INSERT INTO workspaces (id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            info!("Creating workspace: {} ({})", body.name, id);
            let workspace = Workspace {
                id,
                name: body.name.clone(),
                description: body.description.clone(),
                tiles: Vec::new(),
                created_at: now,
                updated_at: now,
            };
            HttpResponse::Created().json(ApiResponse::ok(workspace))
        }
        Err(e) => {
            HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err(format!("Database error: {e}")))
        }
    }
}

/// GET /api/workspaces/{id}
#[get("/workspaces/{id}")]
pub async fn get_workspace(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();

    let ws_row = sqlx::query(
        "SELECT id, name, description, created_at, updated_at FROM workspaces WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match ws_row {
        Ok(Some(row)) => {
            let mut ws = Workspace {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                tiles: Vec::new(),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };

            // Load tiles for this workspace
            let tile_rows = sqlx::query(
                "SELECT id, workspace_id, platform, config, position_x, position_y, position_w, position_h, refresh_interval_secs FROM tiles WHERE workspace_id = $1",
            )
            .bind(id)
            .fetch_all(&state.db)
            .await;

            match tile_rows {
                Ok(rows) => {
                    ws.tiles = rows
                        .iter()
                        .filter_map(|r| tile_from_row(r).ok())
                        .collect();
                    HttpResponse::Ok().json(ApiResponse::ok(ws))
                }
                Err(e) => HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err(format!("Database error loading tiles: {e}"))),
            }
        }
        Ok(None) => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Workspace {id} not found"))),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// PUT /api/workspaces/{id}
#[put("/workspaces/{id}")]
pub async fn update_workspace(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateWorkspaceRequest>,
) -> HttpResponse {
    let id = path.into_inner();
    let now = Utc::now();

    let result = sqlx::query(
        r#"UPDATE workspaces
           SET name = COALESCE($2, name),
               description = COALESCE($3, description),
               updated_at = $4
           WHERE id = $1
           RETURNING id, name, description, created_at, updated_at"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(now)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(row)) => {
            info!("Updated workspace {}", id);
            let ws = Workspace {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                tiles: Vec::new(),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };
            HttpResponse::Ok().json(ApiResponse::ok(ws))
        }
        Ok(None) => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Workspace {id} not found"))),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// DELETE /api/workspaces/{id}
#[delete("/workspaces/{id}")]
pub async fn delete_workspace(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();

    let result = sqlx::query("DELETE FROM workspaces WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            info!("Deleted workspace {}", id);
            HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({ "deleted": id })))
        }
        Ok(_) => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Workspace {id} not found"))),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}
