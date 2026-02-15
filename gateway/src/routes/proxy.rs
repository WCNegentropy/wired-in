use actix_web::{get, post, web, HttpRequest, HttpResponse};
use log::{error, info};
use sqlx::Row;

use crate::middleware::AuthenticatedUser;
use crate::models::{ApiResponse, SubscribeRequest};
use crate::rate_limit::RateLimiter;
use crate::state::AppState;

/// Look up the user's API key for a given platform.
/// Returns (key_value, Option<key_secret>).
async fn lookup_api_key(
    db: &sqlx::PgPool,
    user_id: uuid::Uuid,
    platform: &str,
) -> Option<(String, Option<String>)> {
    let row = sqlx::query(
        "SELECT key_value, key_secret FROM api_keys WHERE user_id = $1 AND platform = $2 AND is_active = true LIMIT 1",
    )
    .bind(user_id)
    .bind(platform)
    .fetch_optional(db)
    .await
    .ok()?;

    row.map(|r| {
        let key_value: String = r.get("key_value");
        let key_secret: Option<String> = r.get("key_secret");
        (key_value, key_secret)
    })
}

/// GET /api/feeds/{platform}
/// Proxy the request to the workers service, forwarding API keys if available.
#[get("/feeds/{platform}")]
pub async fn get_feeds(
    state: web::Data<AppState>,
    path: web::Path<String>,
    req: HttpRequest,
    user: Option<AuthenticatedUser>,
    limiter: web::Data<RateLimiter>,
) -> HttpResponse {
    // Rate limiting for proxy endpoints
    if let Some(ref u) = user {
        if !limiter.check(&format!("proxy:{}", u.user_id), 30) {
            return HttpResponse::TooManyRequests()
                .json(ApiResponse::<()>::err("Rate limit exceeded for proxy requests"));
        }
    }

    let platform = path.into_inner();
    let query_string = req.query_string();

    // Check Redis cache first
    let cache_key = format!("proxy:feeds:{}:{}", platform, query_string);
    let mut redis = state.redis.clone();
    if let Some(cached) = crate::cache::get_cached(&mut redis, &cache_key).await {
        info!("Cache hit for proxy feeds/{}", platform);
        return HttpResponse::Ok()
            .content_type("application/json")
            .body(cached);
    }

    let url = if query_string.is_empty() {
        format!("{}/feeds/{}", state.workers_url, platform)
    } else {
        format!("{}/feeds/{}?{}", state.workers_url, platform, query_string)
    };

    info!("Proxying GET /api/feeds/{} -> {}", platform, url);

    // Build request, forwarding API keys if the user is authenticated
    let mut request_builder = state.http_client.get(&url);

    if let Some(ref u) = user {
        if let Some((key_value, key_secret)) = lookup_api_key(&state.db, u.user_id, &platform).await {
            request_builder = request_builder.header("X-Platform-Api-Key", key_value);
            if let Some(secret) = key_secret {
                request_builder = request_builder.header("X-Platform-Api-Secret", secret);
            }
        }
    }

    match request_builder.send().await {
        Ok(resp) => {
            let status = resp.status();
            match resp.text().await {
                Ok(body) => {
                    if status.is_success() {
                        let _ = crate::cache::set_cached(&mut redis, &cache_key, &body, 300).await;
                    }
                    HttpResponse::build(
                        actix_web::http::StatusCode::from_u16(status.as_u16())
                            .unwrap_or(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR),
                    )
                    .content_type("application/json")
                    .body(body)
                }
                Err(e) => {
                    error!("Failed to read workers response body: {}", e);
                    HttpResponse::BadGateway()
                        .json(ApiResponse::<()>::err(format!("Upstream read error: {e}")))
                }
            }
        }
        Err(e) => {
            error!("Failed to reach workers service: {}", e);
            HttpResponse::BadGateway()
                .json(ApiResponse::<()>::err(format!("Workers service unreachable: {e}")))
        }
    }
}

/// GET /api/content
/// Proxy the request to the aggregator service.
#[get("/content")]
pub async fn get_content(
    state: web::Data<AppState>,
    req: HttpRequest,
    user: Option<AuthenticatedUser>,
    limiter: web::Data<RateLimiter>,
) -> HttpResponse {
    if let Some(ref u) = user {
        if !limiter.check(&format!("api:{}", u.user_id), 100) {
            return HttpResponse::TooManyRequests()
                .json(ApiResponse::<()>::err("Rate limit exceeded"));
        }
    }

    let query_string = req.query_string();

    // Check Redis cache first
    let cache_key = format!("proxy:content:{}", query_string);
    let mut redis = state.redis.clone();
    if let Some(cached) = crate::cache::get_cached(&mut redis, &cache_key).await {
        info!("Cache hit for proxy content");
        return HttpResponse::Ok()
            .content_type("application/json")
            .body(cached);
    }

    let url = if query_string.is_empty() {
        format!("{}/content", state.aggregator_url)
    } else {
        format!("{}/content?{}", state.aggregator_url, query_string)
    };

    info!("Proxying GET /api/content -> {}", url);

    match state.http_client.get(&url).send().await {
        Ok(resp) => {
            let status = resp.status();
            match resp.text().await {
                Ok(body) => {
                    if status.is_success() {
                        let _ = crate::cache::set_cached(&mut redis, &cache_key, &body, 120).await;
                    }
                    HttpResponse::build(
                        actix_web::http::StatusCode::from_u16(status.as_u16())
                            .unwrap_or(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR),
                    )
                    .content_type("application/json")
                    .body(body)
                }
                Err(e) => {
                    error!("Failed to read aggregator response body: {}", e);
                    HttpResponse::BadGateway()
                        .json(ApiResponse::<()>::err(format!("Upstream read error: {e}")))
                }
            }
        }
        Err(e) => {
            error!("Failed to reach aggregator service: {}", e);
            HttpResponse::BadGateway().json(ApiResponse::<()>::err(format!(
                "Aggregator service unreachable: {e}"
            )))
        }
    }
}

/// GET /api/search
/// Proxy the request to the aggregator search endpoint.
#[get("/search")]
pub async fn search_content(
    state: web::Data<AppState>,
    req: HttpRequest,
    user: Option<AuthenticatedUser>,
    limiter: web::Data<RateLimiter>,
) -> HttpResponse {
    if let Some(ref u) = user {
        if !limiter.check(&format!("api:{}", u.user_id), 100) {
            return HttpResponse::TooManyRequests()
                .json(ApiResponse::<()>::err("Rate limit exceeded"));
        }
    }

    let query_string = req.query_string();

    // Check Redis cache first
    let cache_key = format!("proxy:search:{}", query_string);
    let mut redis = state.redis.clone();
    if let Some(cached) = crate::cache::get_cached(&mut redis, &cache_key).await {
        info!("Cache hit for proxy search");
        return HttpResponse::Ok()
            .content_type("application/json")
            .body(cached);
    }

    let url = if query_string.is_empty() {
        format!("{}/search", state.aggregator_url)
    } else {
        format!("{}/search?{}", state.aggregator_url, query_string)
    };

    info!("Proxying GET /api/search -> {}", url);

    match state.http_client.get(&url).send().await {
        Ok(resp) => {
            let status = resp.status();
            match resp.text().await {
                Ok(body) => {
                    if status.is_success() {
                        let _ = crate::cache::set_cached(&mut redis, &cache_key, &body, 60).await;
                    }
                    HttpResponse::build(
                        actix_web::http::StatusCode::from_u16(status.as_u16())
                            .unwrap_or(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR),
                    )
                    .content_type("application/json")
                    .body(body)
                }
                Err(e) => {
                    error!("Failed to read aggregator response body: {}", e);
                    HttpResponse::BadGateway()
                        .json(ApiResponse::<()>::err(format!("Upstream read error: {e}")))
                }
            }
        }
        Err(e) => {
            error!("Failed to reach aggregator service: {}", e);
            HttpResponse::BadGateway().json(ApiResponse::<()>::err(format!(
                "Aggregator service unreachable: {e}"
            )))
        }
    }
}

/// POST /api/feeds/{platform}/subscribe
/// Subscribe to a platform feed via the workers service.
#[post("/feeds/{platform}/subscribe")]
pub async fn subscribe_feed(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<SubscribeRequest>,
) -> HttpResponse {
    let platform = path.into_inner();
    let url = format!("{}/feeds/{}/subscribe", state.workers_url, platform);

    info!("Proxying POST /api/feeds/{}/subscribe -> {}", platform, url);

    match state
        .http_client
        .post(&url)
        .json(&body.into_inner())
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            match resp.text().await {
                Ok(body) => HttpResponse::build(
                    actix_web::http::StatusCode::from_u16(status.as_u16())
                        .unwrap_or(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR),
                )
                .content_type("application/json")
                .body(body),
                Err(e) => {
                    error!("Failed to read workers response body: {}", e);
                    HttpResponse::BadGateway()
                        .json(ApiResponse::<()>::err(format!("Upstream read error: {e}")))
                }
            }
        }
        Err(e) => {
            error!("Failed to reach workers service: {}", e);
            HttpResponse::BadGateway()
                .json(ApiResponse::<()>::err(format!("Workers service unreachable: {e}")))
        }
    }
}
