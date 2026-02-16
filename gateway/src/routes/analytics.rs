use actix_web::{get, post, web, HttpResponse};
use chrono::{Duration, Utc};
use log::info;
use sqlx::Row;
use uuid::Uuid;

use crate::middleware::AuthenticatedUser;
use crate::models::{
    ApiResponse, DailyClickCount, PlatformCount, TopContentItem, TrackClickRequest,
    WorkspaceAnalytics,
};
use crate::state::AppState;

/// POST /api/analytics/click
#[post("/analytics/click")]
pub async fn track_click(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    body: web::Json<TrackClickRequest>,
) -> HttpResponse {
    let result = sqlx::query(
        "INSERT INTO content_clicks (user_id, workspace_id, tile_id, content_id, platform, title, url) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(user.user_id)
    .bind(body.workspace_id)
    .bind(body.tile_id)
    .bind(&body.content_id)
    .bind(&body.platform)
    .bind(&body.title)
    .bind(&body.url)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => HttpResponse::Created().json(ApiResponse::ok(serde_json::json!({"tracked": true}))),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// GET /api/analytics/workspace/{id}?period=7|30|all
#[get("/analytics/workspace/{id}")]
pub async fn get_workspace_analytics(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    let workspace_id = path.into_inner();

    // Verify ownership
    let ws_exists: Result<Option<bool>, _> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = $1 AND user_id = $2)",
    )
    .bind(workspace_id)
    .bind(user.user_id)
    .fetch_optional(&state.db)
    .await;

    match ws_exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound()
                .json(ApiResponse::<()>::err("Workspace not found"));
        }
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err(format!("Database error: {e}")));
        }
        _ => {}
    }

    let period = query.get("period").map(|s| s.as_str()).unwrap_or("30");
    let now = Utc::now();
    let period_start = match period {
        "7" => now - Duration::days(7),
        "all" => now - Duration::days(365 * 10),
        _ => now - Duration::days(30),
    };

    // Total clicks
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM content_clicks WHERE user_id = $1 AND workspace_id = $2 AND clicked_at >= $3",
    )
    .bind(user.user_id)
    .bind(workspace_id)
    .bind(period_start)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    // Platform breakdown
    let platform_rows = sqlx::query(
        "SELECT platform, COUNT(*) as count FROM content_clicks WHERE user_id = $1 AND workspace_id = $2 AND clicked_at >= $3 GROUP BY platform ORDER BY count DESC",
    )
    .bind(user.user_id)
    .bind(workspace_id)
    .bind(period_start)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let platform_breakdown: Vec<PlatformCount> = platform_rows
        .iter()
        .map(|r| {
            let count: i64 = r.get("count");
            PlatformCount {
                platform: r.get("platform"),
                count,
                percentage: if total > 0 {
                    (count as f64 / total as f64) * 100.0
                } else {
                    0.0
                },
            }
        })
        .collect();

    // Top content (top 20)
    let top_rows = sqlx::query(
        "SELECT content_id, title, url, platform, COUNT(*) as click_count FROM content_clicks WHERE user_id = $1 AND workspace_id = $2 AND clicked_at >= $3 GROUP BY content_id, title, url, platform ORDER BY click_count DESC LIMIT 20",
    )
    .bind(user.user_id)
    .bind(workspace_id)
    .bind(period_start)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let top_content: Vec<TopContentItem> = top_rows
        .iter()
        .map(|r| TopContentItem {
            content_id: r.get("content_id"),
            title: r.get("title"),
            url: r.get("url"),
            platform: r.get("platform"),
            click_count: r.get("click_count"),
        })
        .collect();

    // Daily clicks (limited to period)
    let daily_rows = sqlx::query(
        "SELECT DATE(clicked_at) as day, COUNT(*) as count FROM content_clicks WHERE user_id = $1 AND workspace_id = $2 AND clicked_at >= $3 GROUP BY DATE(clicked_at) ORDER BY day",
    )
    .bind(user.user_id)
    .bind(workspace_id)
    .bind(period_start)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let daily_clicks: Vec<DailyClickCount> = daily_rows
        .iter()
        .map(|r| {
            let day: chrono::NaiveDate = r.get("day");
            DailyClickCount {
                day: day.to_string(),
                count: r.get("count"),
            }
        })
        .collect();

    info!(
        "Analytics for workspace {} user {}: {} total clicks",
        workspace_id, user.user_id, total
    );

    HttpResponse::Ok().json(ApiResponse::ok(WorkspaceAnalytics {
        workspace_id,
        total_clicks: total,
        platform_breakdown,
        top_content,
        daily_clicks,
        period_start,
        period_end: now,
    }))
}

/// GET /api/analytics/workspace/{id}/export
#[get("/analytics/workspace/{id}/export")]
pub async fn export_analytics_csv(
    state: web::Data<AppState>,
    user: AuthenticatedUser,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let workspace_id = path.into_inner();

    let rows = sqlx::query(
        "SELECT content_id, platform, title, url, clicked_at FROM content_clicks WHERE user_id = $1 AND workspace_id = $2 ORDER BY clicked_at DESC",
    )
    .bind(user.user_id)
    .bind(workspace_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let mut csv = String::from("content_id,platform,title,url,clicked_at\n");
            for r in &rows {
                let content_id: &str = r.get("content_id");
                let platform: &str = r.get("platform");
                let title: Option<String> = r.get("title");
                let url: &str = r.get("url");
                let clicked_at: chrono::DateTime<Utc> = r.get("clicked_at");
                csv.push_str(&format!(
                    "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
                    content_id.replace('"', "\"\""),
                    platform,
                    title.unwrap_or_default().replace('"', "\"\""),
                    url.replace('"', "\"\""),
                    clicked_at.to_rfc3339()
                ));
            }
            HttpResponse::Ok()
                .content_type("text/csv")
                .insert_header(("Content-Disposition", "attachment; filename=\"analytics.csv\""))
                .body(csv)
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}
