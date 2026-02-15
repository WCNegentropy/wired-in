use actix_web::{delete, get, post, put, web, HttpResponse};
use chrono::Utc;
use log::info;
use uuid::Uuid;

use crate::models::{ApiResponse, CreateWorkspaceRequest, UpdateWorkspaceRequest, Workspace};
use crate::state::AppState;

/// GET /api/workspaces
#[get("/workspaces")]
pub async fn list_workspaces(state: web::Data<AppState>) -> HttpResponse {
    let workspaces = state.workspaces.lock().unwrap().clone();
    info!("Listing {} workspaces", workspaces.len());
    HttpResponse::Ok().json(ApiResponse::ok(workspaces))
}

/// POST /api/workspaces
#[post("/workspaces")]
pub async fn create_workspace(
    state: web::Data<AppState>,
    body: web::Json<CreateWorkspaceRequest>,
) -> HttpResponse {
    let now = Utc::now();
    let workspace = Workspace {
        id: Uuid::new_v4(),
        name: body.name.clone(),
        description: body.description.clone(),
        tiles: Vec::new(),
        created_at: now,
        updated_at: now,
    };

    info!("Creating workspace: {} ({})", workspace.name, workspace.id);
    state.workspaces.lock().unwrap().push(workspace.clone());

    HttpResponse::Created().json(ApiResponse::ok(workspace))
}

/// GET /api/workspaces/{id}
#[get("/workspaces/{id}")]
pub async fn get_workspace(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();

    let ws = {
        let workspaces = state.workspaces.lock().unwrap();
        workspaces.iter().find(|w| w.id == id).cloned()
    }; // workspaces lock released here

    match ws {
        Some(mut ws) => {
            // Attach the workspace's tiles from the tile store.
            let tiles = state.tiles.lock().unwrap();
            ws.tiles = tiles.iter().filter(|t| t.workspace_id == id).cloned().collect();
            HttpResponse::Ok().json(ApiResponse::ok(ws))
        }
        None => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Workspace {id} not found"))),
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
    let mut workspaces = state.workspaces.lock().unwrap();

    match workspaces.iter_mut().find(|w| w.id == id) {
        Some(ws) => {
            if let Some(ref name) = body.name {
                ws.name = name.clone();
            }
            if let Some(ref desc) = body.description {
                ws.description = Some(desc.clone());
            }
            ws.updated_at = Utc::now();

            info!("Updated workspace {}", id);
            let ws = ws.clone();
            HttpResponse::Ok().json(ApiResponse::ok(ws))
        }
        None => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Workspace {id} not found"))),
    }
}

/// DELETE /api/workspaces/{id}
#[delete("/workspaces/{id}")]
pub async fn delete_workspace(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();

    let found = {
        let mut workspaces = state.workspaces.lock().unwrap();
        let len_before = workspaces.len();
        workspaces.retain(|w| w.id != id);
        workspaces.len() < len_before
    }; // workspaces lock released here

    if found {
        // Remove associated tiles (separate lock scope).
        state.tiles.lock().unwrap().retain(|t| t.workspace_id != id);

        info!("Deleted workspace {}", id);
        HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({ "deleted": id })))
    } else {
        HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Workspace {id} not found")))
    }
}
