use actix_web::{delete, get, post, put, web, HttpRequest, HttpResponse};
use log::info;
use sqlx::Row;
use uuid::Uuid;

use crate::middleware::AuthenticatedUser;
use crate::models::{
    ApiResponse, BookmarkResponse, CreateBookmarkRequest, UpdateBookmarkRequest,
};
use crate::state::AppState;

/// GET /api/bookmarks?platform=optional
#[get("/bookmarks")]
pub async fn list_bookmarks(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    req: HttpRequest,
) -> HttpResponse {
    let platform_filter: Option<String> = req
        .query_string()
        .split('&')
        .find_map(|pair| {
            let mut kv = pair.splitn(2, '=');
            match (kv.next(), kv.next()) {
                (Some("platform"), Some(v)) if !v.is_empty() => Some(v.to_string()),
                _ => None,
            }
        });

    let rows = if let Some(ref platform) = platform_filter {
        sqlx::query(
            "SELECT id, content_id, platform, title, url, thumbnail_url, author, notes, created_at \
             FROM bookmarks WHERE user_id = $1 AND platform = $2 ORDER BY created_at DESC",
        )
        .bind(user.user_id)
        .bind(platform)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(
            "SELECT id, content_id, platform, title, url, thumbnail_url, author, notes, created_at \
             FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user.user_id)
        .fetch_all(&state.db)
        .await
    };

    match rows {
        Ok(rows) => {
            let bookmarks: Vec<BookmarkResponse> = rows
                .iter()
                .map(|r| BookmarkResponse {
                    id: r.get("id"),
                    content_id: r.get("content_id"),
                    platform: r.get("platform"),
                    title: r.get("title"),
                    url: r.get("url"),
                    thumbnail_url: r.get("thumbnail_url"),
                    author: r.get("author"),
                    notes: r.get("notes"),
                    created_at: r.get("created_at"),
                })
                .collect();
            info!("Listing {} bookmarks for user {}", bookmarks.len(), user.user_id);
            HttpResponse::Ok().json(ApiResponse::ok(bookmarks))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// POST /api/bookmarks
#[post("/bookmarks")]
pub async fn create_bookmark(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    body: web::Json<CreateBookmarkRequest>,
) -> HttpResponse {
    let id = Uuid::new_v4();

    let result = sqlx::query(
        "INSERT INTO bookmarks (id, user_id, content_id, platform, title, url, thumbnail_url, author, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING id, content_id, platform, title, url, thumbnail_url, author, notes, created_at",
    )
    .bind(id)
    .bind(user.user_id)
    .bind(&body.content_id)
    .bind(&body.platform)
    .bind(&body.title)
    .bind(&body.url)
    .bind(&body.thumbnail_url)
    .bind(&body.author)
    .bind(&body.notes)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(row) => {
            info!("Bookmark created {} for user {}", id, user.user_id);
            HttpResponse::Created().json(ApiResponse::ok(BookmarkResponse {
                id: row.get("id"),
                content_id: row.get("content_id"),
                platform: row.get("platform"),
                title: row.get("title"),
                url: row.get("url"),
                thumbnail_url: row.get("thumbnail_url"),
                author: row.get("author"),
                notes: row.get("notes"),
                created_at: row.get("created_at"),
            }))
        }
        Err(e) => {
            if e.to_string().contains("duplicate key") || e.to_string().contains("unique") {
                HttpResponse::Conflict()
                    .json(ApiResponse::<()>::err("Content already bookmarked"))
            } else {
                HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err(format!("Database error: {e}")))
            }
        }
    }
}

/// PUT /api/bookmarks/{id}
#[put("/bookmarks/{id}")]
pub async fn update_bookmark(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    body: web::Json<UpdateBookmarkRequest>,
) -> HttpResponse {
    let id = path.into_inner();

    let result = sqlx::query(
        "UPDATE bookmarks SET notes = $3 \
         WHERE id = $1 AND user_id = $2 \
         RETURNING id, content_id, platform, title, url, thumbnail_url, author, notes, created_at",
    )
    .bind(id)
    .bind(user.user_id)
    .bind(&body.notes)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(row)) => {
            info!("Bookmark {} updated", id);
            HttpResponse::Ok().json(ApiResponse::ok(BookmarkResponse {
                id: row.get("id"),
                content_id: row.get("content_id"),
                platform: row.get("platform"),
                title: row.get("title"),
                url: row.get("url"),
                thumbnail_url: row.get("thumbnail_url"),
                author: row.get("author"),
                notes: row.get("notes"),
                created_at: row.get("created_at"),
            }))
        }
        Ok(None) => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Bookmark {id} not found"))),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// DELETE /api/bookmarks/{id}
#[delete("/bookmarks/{id}")]
pub async fn delete_bookmark(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();

    let result = sqlx::query("DELETE FROM bookmarks WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            info!("Bookmark {} deleted", id);
            HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({ "deleted": id })))
        }
        Ok(_) => HttpResponse::NotFound()
            .json(ApiResponse::<()>::err(format!("Bookmark {id} not found"))),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// GET /api/bookmarks/check?content_id=abc&content_id=def
/// Returns a JSON object mapping content_id -> bookmark UUID for items that are bookmarked.
#[get("/bookmarks/check")]
pub async fn check_bookmarked(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    req: HttpRequest,
) -> HttpResponse {
    let content_ids: Vec<String> = req
        .query_string()
        .split('&')
        .filter_map(|pair| {
            let mut kv = pair.splitn(2, '=');
            match (kv.next(), kv.next()) {
                (Some("content_id"), Some(v)) if !v.is_empty() => {
                    Some(urlencoding::decode(v).unwrap_or_default().into_owned())
                }
                _ => None,
            }
        })
        .collect();

    if content_ids.is_empty() {
        return HttpResponse::Ok()
            .json(ApiResponse::ok(serde_json::json!({})));
    }

    let rows = sqlx::query(
        "SELECT id, content_id FROM bookmarks WHERE user_id = $1 AND content_id = ANY($2)",
    )
    .bind(user.user_id)
    .bind(&content_ids)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let mut map = serde_json::Map::new();
            for row in &rows {
                let content_id: String = row.get("content_id");
                let id: Uuid = row.get("id");
                map.insert(content_id, serde_json::json!(id));
            }
            HttpResponse::Ok().json(ApiResponse::ok(serde_json::Value::Object(map)))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}
