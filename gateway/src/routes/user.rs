use actix_web::{get, put, web, HttpResponse};
use log::info;
use sqlx::Row;

use crate::middleware::AuthenticatedUser;
use crate::models::{ApiResponse, UserPreferences};
use crate::state::AppState;

/// GET /api/user/preferences
#[get("/user/preferences")]
pub async fn get_preferences(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
) -> HttpResponse {
    let row = sqlx::query("SELECT preferences FROM users WHERE id = $1")
        .bind(user.user_id)
        .fetch_optional(&state.db)
        .await;

    match row {
        Ok(Some(row)) => {
            let prefs_json: serde_json::Value = row.get("preferences");
            let prefs: UserPreferences =
                serde_json::from_value(prefs_json).unwrap_or_default();
            HttpResponse::Ok().json(ApiResponse::ok(prefs))
        }
        Ok(None) => {
            HttpResponse::NotFound().json(ApiResponse::<()>::err("User not found"))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// PUT /api/user/preferences
/// Merge-update preferences using JSONB || operator.
#[put("/user/preferences")]
pub async fn update_preferences(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let update_value = body.into_inner();

    let result = sqlx::query(
        "UPDATE users SET preferences = preferences || $2, updated_at = NOW() WHERE id = $1 RETURNING preferences",
    )
    .bind(user.user_id)
    .bind(&update_value)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(row)) => {
            let prefs_json: serde_json::Value = row.get("preferences");
            let prefs: UserPreferences =
                serde_json::from_value(prefs_json).unwrap_or_default();
            info!("Preferences updated for user {}", user.user_id);
            HttpResponse::Ok().json(ApiResponse::ok(prefs))
        }
        Ok(None) => {
            HttpResponse::NotFound().json(ApiResponse::<()>::err("User not found"))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}
