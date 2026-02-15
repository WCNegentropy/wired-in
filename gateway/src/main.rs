mod auth;
mod cache;
mod db;
mod middleware;
mod models;
mod routes;
mod state;

use actix_cors::Cors;
use actix_web::{get, web, App, HttpResponse, HttpServer, Responder};
use log::info;

use crate::models::HealthResponse;
use crate::state::AppState;

/// GET /health -- lightweight liveness probe.
#[get("/health")]
async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        status: "ok".to_string(),
        service: "wired-in-gateway".to_string(),
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load .env file if present (non-fatal if missing).
    let _ = dotenvy::dotenv();

    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

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

    HttpServer::new(move || {
        let cors = Cors::permissive();

        App::new()
            .wrap(cors)
            .app_data(web::Data::new(app_state.clone()))
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
    async fn test_health_check() {
        let app = test::init_service(
            App::new().service(health_check),
        )
        .await;
        let req = test::TestRequest::get().uri("/health").to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }

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
