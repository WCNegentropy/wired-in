use actix_web::{delete, get, post, put, web, HttpResponse};
use log::info;
use uuid::Uuid;

use crate::models::{ApiResponse, CreateTileRequest, Tile, UpdateTileRequest};
use crate::state::AppState;

/// GET /api/workspaces/{workspace_id}/tiles
#[get("/workspaces/{workspace_id}/tiles")]
pub async fn list_tiles(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let workspace_id = path.into_inner();
    let tiles = state.tiles.lock().unwrap();
    let workspace_tiles: Vec<Tile> = tiles
        .iter()
        .filter(|t| t.workspace_id == workspace_id)
        .cloned()
        .collect();

    info!(
        "Listing {} tiles for workspace {}",
        workspace_tiles.len(),
        workspace_id
    );
    HttpResponse::Ok().json(ApiResponse::ok(workspace_tiles))
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
    {
        let workspaces = state.workspaces.lock().unwrap();
        if !workspaces.iter().any(|w| w.id == workspace_id) {
            return HttpResponse::NotFound().json(ApiResponse::<()>::err(format!(
                "Workspace {workspace_id} not found"
            )));
        }
    }

    let tile = Tile {
        id: Uuid::new_v4(),
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
    state.tiles.lock().unwrap().push(tile.clone());

    HttpResponse::Created().json(ApiResponse::ok(tile))
}

/// PUT /api/tiles/{id}
#[put("/tiles/{id}")]
pub async fn update_tile(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateTileRequest>,
) -> HttpResponse {
    let id = path.into_inner();
    let mut tiles = state.tiles.lock().unwrap();

    match tiles.iter_mut().find(|t| t.id == id) {
        Some(tile) => {
            if let Some(ref config) = body.config {
                tile.config = config.clone();
            }
            if let Some(ref position) = body.position {
                tile.position = position.clone();
            }
            if let Some(interval) = body.refresh_interval_secs {
                tile.refresh_interval_secs = interval;
            }

            info!("Updated tile {}", id);
            let tile = tile.clone();
            HttpResponse::Ok().json(ApiResponse::ok(tile))
        }
        None => {
            HttpResponse::NotFound().json(ApiResponse::<()>::err(format!("Tile {id} not found")))
        }
    }
}

/// DELETE /api/tiles/{id}
#[delete("/tiles/{id}")]
pub async fn delete_tile(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();
    let mut tiles = state.tiles.lock().unwrap();
    let len_before = tiles.len();
    tiles.retain(|t| t.id != id);

    if tiles.len() < len_before {
        info!("Deleted tile {}", id);
        HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({ "deleted": id })))
    } else {
        HttpResponse::NotFound().json(ApiResponse::<()>::err(format!("Tile {id} not found")))
    }
}
