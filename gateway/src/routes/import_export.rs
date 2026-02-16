use actix_web::{get, post, web, HttpResponse};
use chrono::Utc;
use log::info;
use sqlx::Row;
use uuid::Uuid;

use crate::middleware::AuthenticatedUser;
use crate::models::{
    ApiResponse, ExportedTile, ExportedWorkspace, ImportResult, OpmlImportResult, Platform,
    TileConfig, TilePosition, WorkspaceExport,
};
use crate::state::AppState;

use super::helpers::tile_from_row;

/// GET /api/workspaces/{id}/export
#[get("/workspaces/{id}/export")]
pub async fn export_workspace(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let workspace_id = path.into_inner();

    let ws_row = sqlx::query(
        "SELECT id, name, description FROM workspaces WHERE id = $1 AND user_id = $2",
    )
    .bind(workspace_id)
    .bind(user.user_id)
    .fetch_optional(&state.db)
    .await;

    match ws_row {
        Ok(Some(row)) => {
            let tile_rows = sqlx::query(
                "SELECT id, workspace_id, platform, config, position_x, position_y, position_w, position_h, refresh_interval_secs FROM tiles WHERE workspace_id = $1",
            )
            .bind(workspace_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();

            let tiles: Vec<ExportedTile> = tile_rows
                .iter()
                .filter_map(|r| {
                    let tile = tile_from_row(r).ok()?;
                    Some(ExportedTile {
                        platform: tile.platform,
                        config: tile.config,
                        position: tile.position,
                        refresh_interval_secs: tile.refresh_interval_secs,
                    })
                })
                .collect();

            let export = WorkspaceExport {
                version: "1.0".to_string(),
                exported_at: Utc::now(),
                workspaces: vec![ExportedWorkspace {
                    name: row.get("name"),
                    description: row.get("description"),
                    tiles,
                }],
            };

            HttpResponse::Ok().json(ApiResponse::ok(export))
        }
        Ok(None) => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err("Workspace not found")),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// GET /api/workspaces/export-all
#[get("/workspaces/export-all")]
pub async fn export_all_workspaces(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
) -> HttpResponse {
    let ws_rows = sqlx::query(
        "SELECT id, name, description FROM workspaces WHERE user_id = $1 ORDER BY created_at",
    )
    .bind(user.user_id)
    .fetch_all(&state.db)
    .await;

    match ws_rows {
        Ok(ws_rows) => {
            let mut workspaces = Vec::new();
            for ws_row in &ws_rows {
                let ws_id: Uuid = ws_row.get("id");
                let tile_rows = sqlx::query(
                    "SELECT id, workspace_id, platform, config, position_x, position_y, position_w, position_h, refresh_interval_secs FROM tiles WHERE workspace_id = $1",
                )
                .bind(ws_id)
                .fetch_all(&state.db)
                .await
                .unwrap_or_default();

                let tiles: Vec<ExportedTile> = tile_rows
                    .iter()
                    .filter_map(|r| {
                        let tile = tile_from_row(r).ok()?;
                        Some(ExportedTile {
                            platform: tile.platform,
                            config: tile.config,
                            position: tile.position,
                            refresh_interval_secs: tile.refresh_interval_secs,
                        })
                    })
                    .collect();

                workspaces.push(ExportedWorkspace {
                    name: ws_row.get("name"),
                    description: ws_row.get("description"),
                    tiles,
                });
            }

            let export = WorkspaceExport {
                version: "1.0".to_string(),
                exported_at: Utc::now(),
                workspaces,
            };

            HttpResponse::Ok().json(ApiResponse::ok(export))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// POST /api/workspaces/import
#[post("/workspaces/import")]
pub async fn import_workspaces(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    body: web::Json<WorkspaceExport>,
) -> HttpResponse {
    let mut workspace_ids = Vec::new();
    let mut total_tile_count = 0usize;

    for exported_ws in &body.workspaces {
        let ws_id = Uuid::new_v4();
        let now = Utc::now();

        // Check for name collision and suffix if needed
        let existing: Option<bool> = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM workspaces WHERE user_id = $1 AND name = $2)",
        )
        .bind(user.user_id)
        .bind(&exported_ws.name)
        .fetch_one(&state.db)
        .await
        .unwrap_or(Some(false))
        .unwrap_or(false)
        .into();

        let ws_name = if existing == Some(true) {
            format!("{} (imported)", exported_ws.name)
        } else {
            exported_ws.name.clone()
        };

        let result = sqlx::query(
            "INSERT INTO workspaces (id, name, description, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(ws_id)
        .bind(&ws_name)
        .bind(&exported_ws.description)
        .bind(user.user_id)
        .bind(now)
        .bind(now)
        .execute(&state.db)
        .await;

        if let Err(e) = result {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err(format!("Failed to import workspace: {e}")));
        }

        for tile in &exported_ws.tiles {
            let tile_id = Uuid::new_v4();
            let platform_str = serde_json::to_value(&tile.platform)
                .ok()
                .and_then(|v| v.as_str().map(|s| s.to_string()))
                .unwrap_or_else(|| "rss".to_string());

            let result = sqlx::query(
                "INSERT INTO tiles (id, workspace_id, platform, config, position_x, position_y, position_w, position_h, refresh_interval_secs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            )
            .bind(tile_id)
            .bind(ws_id)
            .bind(&platform_str)
            .bind(&tile.config.extra)
            .bind(tile.position.x)
            .bind(tile.position.y)
            .bind(tile.position.w)
            .bind(tile.position.h)
            .bind(tile.refresh_interval_secs as i64)
            .execute(&state.db)
            .await;

            if let Err(e) = result {
                info!("Failed to import tile: {e}");
            } else {
                total_tile_count += 1;
            }
        }

        workspace_ids.push(ws_id);
    }

    info!(
        "Imported {} workspaces with {} tiles for user {}",
        workspace_ids.len(),
        total_tile_count,
        user.user_id
    );

    HttpResponse::Created().json(ApiResponse::ok(ImportResult {
        workspace_count: workspace_ids.len(),
        tile_count: total_tile_count,
        workspace_ids,
    }))
}

/// POST /api/import/opml
/// Accepts an OPML XML string in the request body and creates RSS tiles.
#[post("/import/opml")]
pub async fn import_opml(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    body: web::Bytes,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    let xml_str = match std::str::from_utf8(&body) {
        Ok(s) => s,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<()>::err("Invalid UTF-8 in request body"));
        }
    };

    // Parse feed URLs from OPML using simple XML parsing
    let feed_urls = parse_opml_feeds(xml_str);
    if feed_urls.is_empty() {
        return HttpResponse::BadRequest()
            .json(ApiResponse::<()>::err("No RSS feeds found in OPML file"));
    }

    let ws_name = query
        .get("name")
        .cloned()
        .unwrap_or_else(|| "Imported RSS Feeds".to_string());

    let ws_id = Uuid::new_v4();
    let now = Utc::now();

    let result = sqlx::query(
        "INSERT INTO workspaces (id, name, description, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(ws_id)
    .bind(&ws_name)
    .bind(Some("Imported from OPML"))
    .bind(user.user_id)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await;

    if let Err(e) = result {
        return HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Failed to create workspace: {e}")));
    }

    let mut tile_count = 0usize;
    let cols = 3i32;
    for (i, (title, url)) in feed_urls.iter().enumerate() {
        let tile_id = Uuid::new_v4();
        let col = (i as i32) % cols;
        let row = (i as i32) / cols;

        let config = serde_json::json!({
            "feed_url": url,
            "title": title,
            "maxItems": 10
        });

        let result = sqlx::query(
            "INSERT INTO tiles (id, workspace_id, platform, config, position_x, position_y, position_w, position_h, refresh_interval_secs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(tile_id)
        .bind(ws_id)
        .bind("rss")
        .bind(&config)
        .bind(col * 4)
        .bind(row * 3)
        .bind(4)
        .bind(3)
        .bind(300i64)
        .execute(&state.db)
        .await;

        if result.is_ok() {
            tile_count += 1;
        }
    }

    info!(
        "OPML import: {} feeds imported into workspace '{}' for user {}",
        tile_count, ws_name, user.user_id
    );

    HttpResponse::Created().json(ApiResponse::ok(OpmlImportResult {
        workspace_id: ws_id,
        workspace_name: ws_name,
        tile_count,
    }))
}

/// Parse OPML XML and extract feed URLs.
/// Returns a list of (title, xmlUrl) pairs.
fn parse_opml_feeds(xml: &str) -> Vec<(String, String)> {
    let mut feeds = Vec::new();

    // Use quick-xml to parse
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(ref e)) | Ok(Event::Start(ref e)) if e.name().as_ref() == b"outline" => {
                let mut title = String::new();
                let mut xml_url = String::new();

                for attr in e.attributes().flatten() {
                    let key = std::str::from_utf8(attr.key.as_ref()).unwrap_or("");
                    let val = attr.unescape_value().unwrap_or_default().to_string();
                    match key {
                        "text" | "title" => {
                            if title.is_empty() {
                                title = val;
                            }
                        }
                        "xmlUrl" | "xmlurl" => {
                            xml_url = val;
                        }
                        _ => {}
                    }
                }

                if !xml_url.is_empty() {
                    if title.is_empty() {
                        title = xml_url.clone();
                    }
                    feeds.push((title, xml_url));
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    feeds
}
