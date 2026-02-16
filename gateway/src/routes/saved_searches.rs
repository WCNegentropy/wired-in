use actix_web::{delete, get, post, put, web, HttpResponse};
use log::info;
use sqlx::Row;
use uuid::Uuid;

use crate::middleware::AuthenticatedUser;
use crate::models::{
    ApiResponse, CreateSavedSearchRequest, SavedSearchResponse, UpdateSavedSearchRequest,
};
use crate::state::AppState;

/// GET /api/saved-searches
#[get("/saved-searches")]
pub async fn list_searches(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
) -> HttpResponse {
    let rows = sqlx::query(
        "SELECT id, name, query, platforms, notify, created_at FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(user.user_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let searches: Vec<SavedSearchResponse> = rows
                .iter()
                .map(|r| SavedSearchResponse {
                    id: r.get("id"),
                    name: r.get("name"),
                    query: r.get("query"),
                    platforms: r.get("platforms"),
                    notify: r.get("notify"),
                    created_at: r.get("created_at"),
                })
                .collect();
            HttpResponse::Ok().json(ApiResponse::ok(searches))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// POST /api/saved-searches
#[post("/saved-searches")]
pub async fn create_search(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    body: web::Json<CreateSavedSearchRequest>,
) -> HttpResponse {
    let result = sqlx::query(
        "INSERT INTO saved_searches (user_id, name, query, platforms, notify) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, query, platforms, notify, created_at",
    )
    .bind(user.user_id)
    .bind(&body.name)
    .bind(&body.query)
    .bind(&body.platforms)
    .bind(body.notify)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(row) => {
            info!(
                "Saved search '{}' created for user {}",
                body.name, user.user_id
            );
            HttpResponse::Created().json(ApiResponse::ok(SavedSearchResponse {
                id: row.get("id"),
                name: row.get("name"),
                query: row.get("query"),
                platforms: row.get("platforms"),
                notify: row.get("notify"),
                created_at: row.get("created_at"),
            }))
        }
        Err(e) => {
            if e.to_string().contains("duplicate key") || e.to_string().contains("unique") {
                HttpResponse::Conflict().json(ApiResponse::<()>::err(
                    "A saved search with this name already exists",
                ))
            } else {
                HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err(format!("Database error: {e}")))
            }
        }
    }
}

/// PUT /api/saved-searches/{id}
#[put("/saved-searches/{id}")]
pub async fn update_search(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    body: web::Json<UpdateSavedSearchRequest>,
) -> HttpResponse {
    let id = path.into_inner();

    let result = sqlx::query(
        r#"UPDATE saved_searches
           SET name = COALESCE($2, name),
               query = COALESCE($3, query),
               platforms = COALESCE($4, platforms),
               notify = COALESCE($5, notify)
           WHERE id = $1 AND user_id = $6
           RETURNING id, name, query, platforms, notify, created_at"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.query)
    .bind(&body.platforms)
    .bind(body.notify)
    .bind(user.user_id)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(row)) => {
            info!("Saved search {} updated", id);
            HttpResponse::Ok().json(ApiResponse::ok(SavedSearchResponse {
                id: row.get("id"),
                name: row.get("name"),
                query: row.get("query"),
                platforms: row.get("platforms"),
                notify: row.get("notify"),
                created_at: row.get("created_at"),
            }))
        }
        Ok(None) => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Saved search {id} not found"))),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// DELETE /api/saved-searches/{id}
#[delete("/saved-searches/{id}")]
pub async fn delete_search(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();
    let result = sqlx::query("DELETE FROM saved_searches WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            info!("Saved search {} deleted", id);
            HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({ "deleted": id })))
        }
        Ok(_) => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Saved search {id} not found"))),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}
