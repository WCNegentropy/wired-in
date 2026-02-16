mod auth;
mod cache;
pub mod crypto;
mod db;
mod middleware;
mod models;
mod rate_limit;
mod routes;
mod state;

use actix_cors::Cors;
use actix_web::{get, web, App, HttpResponse, HttpServer, Responder};
use log::{info, warn};
use redis::AsyncCommands;

use crate::models::AggregatedHealthResponse;
use crate::state::AppState;

/// GET /health -- aggregated health check across all services.
#[get("/health")]
async fn health_check(state: web::Data<AppState>) -> impl Responder {
    let db_status = match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => "ok".to_string(),
        Err(_) => "unreachable".to_string(),
    };

    let mut redis = state.redis.clone();
    let redis_status: String = match redis::cmd("PING")
        .query_async::<String>(&mut redis)
        .await
    {
        Ok(_) => "ok".to_string(),
        Err(_) => "unreachable".to_string(),
    };

    let aggregator_status = match state
        .http_client
        .get(format!("{}/health", state.aggregator_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => "ok".to_string(),
        _ => "unreachable".to_string(),
    };

    let workers_status = match state
        .http_client
        .get(format!("{}/health", state.workers_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => "ok".to_string(),
        _ => "unreachable".to_string(),
    };

    HttpResponse::Ok().json(AggregatedHealthResponse {
        gateway: "ok".to_string(),
        aggregator: aggregator_status,
        workers: workers_status,
        db: db_status,
        redis: redis_status,
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}

/// GET / -- root welcome.
#[get("/")]
async fn root() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "wired-in-gateway",
        "version": env!("CARGO_PKG_VERSION"),
        "message": "Wired-In API Gateway is running",
    }))
}

fn build_cors() -> Cors {
    let allowed_origins = std::env::var("CORS_ALLOWED_ORIGINS").unwrap_or_default();

    if allowed_origins.is_empty() || allowed_origins == "*" {
        Cors::permissive()
    } else {
        let mut cors = Cors::default()
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ACCEPT,
            ])
            .max_age(3600);
        for origin in allowed_origins.split(',') {
            let origin = origin.trim();
            if !origin.is_empty() {
                cors = cors.allowed_origin(origin);
            }
        }
        cors
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load .env file if present (non-fatal if missing).
    let _ = dotenvy::dotenv();

    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    // JWT_SECRET enforcement
    let jwt_secret =
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".to_string());
    let rust_log = std::env::var("RUST_LOG").unwrap_or_default();
    if jwt_secret == "dev-secret-change-me" && !rust_log.contains("debug") {
        warn!("WARNING: JWT_SECRET is set to the default insecure value. Change it for production!");
    }

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let app_state = AppState::from_env().await;

    // Run SQL migrations
    sqlx::migrate!("./migrations")
        .run(&app_state.db)
        .await
        .expect("Failed to run database migrations");
    info!("Database migrations applied successfully");

    info!(
        "Aggregator URL : {}",
        app_state.aggregator_url
    );
    info!("Workers URL    : {}", app_state.workers_url);
    info!("Starting Wired-In Gateway on http://0.0.0.0:{}", port);

    let rate_limiter = web::Data::new(rate_limit::RateLimiter::new());

    HttpServer::new(move || {
        let cors = build_cors();

        App::new()
            .wrap(cors)
            .app_data(web::Data::new(app_state.clone()))
            .app_data(rate_limiter.clone())
            .service(health_check)
            .service(root)
            .configure(routes::configure)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test;

    #[actix_rt::test]
    async fn test_root() {
        let app = test::init_service(
            App::new().service(root),
        )
        .await;
        let req = test::TestRequest::get().uri("/").to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
