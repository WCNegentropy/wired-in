use actix_web::{get, post, web, HttpRequest, HttpResponse};
use log::{error, info};

use crate::models::{ApiResponse, SubscribeRequest};
use crate::state::AppState;

/// GET /api/feeds/{platform}
/// Proxy the request to the workers service.
#[get("/feeds/{platform}")]
pub async fn get_feeds(
    state: web::Data<AppState>,
    path: web::Path<String>,
    req: HttpRequest,
) -> HttpResponse {
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

    match state.http_client.get(&url).send().await {
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
) -> HttpResponse {
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
) -> HttpResponse {
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
