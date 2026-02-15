use actix_web::{delete, get, post, put, web, HttpResponse};
use chrono::{DateTime, Utc};
use log::info;
use sqlx::Row;
use uuid::Uuid;

use crate::middleware::AuthenticatedUser;
use crate::models::{ApiKeyResponse, ApiResponse, CreateApiKeyRequest, UpdateApiKeyRequest};
use crate::state::AppState;

fn mask_key(key: &str) -> String {
    if key.len() <= 4 {
        "*".repeat(key.len())
    } else {
        format!("{}...{}", &key[..2], &key[key.len() - 4..])
    }
}

/// GET /api/keys
#[get("/keys")]
pub async fn list_keys(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
) -> HttpResponse {
    let rows = sqlx::query(
        "SELECT id, platform, key_name, key_value, key_secret, is_active, created_at, updated_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(user.user_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let keys: Vec<ApiKeyResponse> = rows
                .iter()
                .map(|r| {
                    let key_value: String = r.get("key_value");
                    let key_secret: Option<String> = r.get("key_secret");
                    ApiKeyResponse {
                        id: r.get("id"),
                        platform: r.get("platform"),
                        key_name: r.get("key_name"),
                        key_value_masked: mask_key(&key_value),
                        has_secret: key_secret.is_some(),
                        is_active: r.get("is_active"),
                        created_at: r.get("created_at"),
                        updated_at: r.get("updated_at"),
                    }
                })
                .collect();
            HttpResponse::Ok().json(ApiResponse::ok(keys))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// POST /api/keys
#[post("/keys")]
pub async fn create_key(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    body: web::Json<CreateApiKeyRequest>,
) -> HttpResponse {
    let result = sqlx::query(
        "INSERT INTO api_keys (user_id, platform, key_name, key_value, key_secret) VALUES ($1, $2, $3, $4, $5) RETURNING id, platform, key_name, key_value, key_secret, is_active, created_at, updated_at",
    )
    .bind(user.user_id)
    .bind(&body.platform)
    .bind(&body.key_name)
    .bind(&body.key_value)
    .bind(&body.key_secret)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(row) => {
            let key_value: String = row.get("key_value");
            let key_secret: Option<String> = row.get("key_secret");
            info!("API key created for user {} platform {}", user.user_id, body.platform);
            HttpResponse::Created().json(ApiResponse::ok(ApiKeyResponse {
                id: row.get("id"),
                platform: row.get("platform"),
                key_name: row.get("key_name"),
                key_value_masked: mask_key(&key_value),
                has_secret: key_secret.is_some(),
                is_active: row.get("is_active"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            }))
        }
        Err(e) => {
            if e.to_string().contains("duplicate key") || e.to_string().contains("unique") {
                HttpResponse::Conflict().json(ApiResponse::<()>::err(
                    "An API key with this platform and name already exists",
                ))
            } else {
                HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err(format!("Database error: {e}")))
            }
        }
    }
}

/// PUT /api/keys/{id}
#[put("/keys/{id}")]
pub async fn update_key(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    body: web::Json<UpdateApiKeyRequest>,
) -> HttpResponse {
    let id = path.into_inner();

    let existing = sqlx::query(
        "SELECT id, key_value, key_secret, is_active FROM api_keys WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(user.user_id)
    .fetch_optional(&state.db)
    .await;

    match existing {
        Ok(Some(row)) => {
            let old_key_value: String = row.get("key_value");
            let old_key_secret: Option<String> = row.get("key_secret");
            let old_is_active: bool = row.get("is_active");

            let new_key_value = body.key_value.as_deref().unwrap_or(&old_key_value);
            let new_key_secret = body.key_secret.as_deref().or(old_key_secret.as_deref());
            let new_is_active = body.is_active.unwrap_or(old_is_active);

            let result = sqlx::query(
                "UPDATE api_keys SET key_value = $2, key_secret = $3, is_active = $4, updated_at = NOW() WHERE id = $1 AND user_id = $5 RETURNING id, platform, key_name, key_value, key_secret, is_active, created_at, updated_at",
            )
            .bind(id)
            .bind(new_key_value)
            .bind(new_key_secret)
            .bind(new_is_active)
            .bind(user.user_id)
            .fetch_optional(&state.db)
            .await;

            match result {
                Ok(Some(updated_row)) => {
                    let key_value: String = updated_row.get("key_value");
                    let key_secret: Option<String> = updated_row.get("key_secret");
                    info!("API key {} updated", id);
                    HttpResponse::Ok().json(ApiResponse::ok(ApiKeyResponse {
                        id: updated_row.get("id"),
                        platform: updated_row.get("platform"),
                        key_name: updated_row.get("key_name"),
                        key_value_masked: mask_key(&key_value),
                        has_secret: key_secret.is_some(),
                        is_active: updated_row.get("is_active"),
                        created_at: updated_row.get("created_at"),
                        updated_at: updated_row.get("updated_at"),
                    }))
                }
                _ => HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err("Update failed")),
            }
        }
        Ok(None) => {
            HttpResponse::NotFound().json(ApiResponse::<()>::err(format!("API key {id} not found")))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// DELETE /api/keys/{id}
#[delete("/keys/{id}")]
pub async fn delete_key(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();
    let result = sqlx::query("DELETE FROM api_keys WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            info!("API key {} deleted", id);
            HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({ "deleted": id })))
        }
        Ok(_) => {
            HttpResponse::NotFound().json(ApiResponse::<()>::err(format!("API key {id} not found")))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}
