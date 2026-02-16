use actix_web::{post, web, HttpRequest, HttpResponse};
use log::info;
use sqlx::Row;

use crate::models::{
    ApiResponse, AuthResponse, LoginRequest, RegisterRequest, UserInfo,
};
use crate::state::AppState;

/// Grace period (in seconds) after token expiry during which refresh is allowed.
const REFRESH_GRACE_PERIOD_SECS: i64 = 900; // 15 minutes

fn jwt_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".to_string())
}

/// POST /api/auth/register
#[post("/register")]
pub async fn register(
    state: web::Data<AppState>,
    body: web::Json<RegisterRequest>,
) -> HttpResponse {
    let secret = jwt_secret();

    // Check email uniqueness
    let exists: Option<bool> =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
            .bind(&body.email)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);

    if exists == Some(true) {
        return HttpResponse::Conflict()
            .json(ApiResponse::<()>::err("Email already registered"));
    }

    // Hash password
    let password_hash = match crate::auth::hash_password(&body.password) {
        Ok(h) => h,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err(format!("Password hashing failed: {e}")));
        }
    };

    // Insert user
    let row = sqlx::query(
        "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name",
    )
    .bind(&body.email)
    .bind(&password_hash)
    .bind(&body.name)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(row) => {
            let user_id: uuid::Uuid = row.get("id");
            let email: String = row.get("email");
            let name: Option<String> = row.get("name");

            let token = match crate::auth::encode_jwt(user_id, &email, &secret) {
                Ok(t) => t,
                Err(e) => {
                    return HttpResponse::InternalServerError()
                        .json(ApiResponse::<()>::err(format!("Token generation failed: {e}")));
                }
            };

            info!("User registered: {} ({})", email, user_id);

            HttpResponse::Created().json(ApiResponse::ok(AuthResponse {
                token,
                user: UserInfo {
                    id: user_id,
                    email,
                    name,
                },
            }))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// POST /api/auth/login
#[post("/login")]
pub async fn login(
    state: web::Data<AppState>,
    body: web::Json<LoginRequest>,
) -> HttpResponse {
    let secret = jwt_secret();

    let row = sqlx::query(
        "SELECT id, email, name, password_hash FROM users WHERE email = $1",
    )
    .bind(&body.email)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => {
            let user_id: uuid::Uuid = row.get("id");
            let email: String = row.get("email");
            let name: Option<String> = row.get("name");
            let password_hash: String = row.get("password_hash");

            if !crate::auth::verify_password(&body.password, &password_hash) {
                return HttpResponse::Unauthorized()
                    .json(ApiResponse::<()>::err("Invalid credentials"));
            }

            let token = match crate::auth::encode_jwt(user_id, &email, &secret) {
                Ok(t) => t,
                Err(e) => {
                    return HttpResponse::InternalServerError()
                        .json(ApiResponse::<()>::err(format!("Token generation failed: {e}")));
                }
            };

            info!("User logged in: {} ({})", email, user_id);

            HttpResponse::Ok().json(ApiResponse::ok(AuthResponse {
                token,
                user: UserInfo {
                    id: user_id,
                    email,
                    name,
                },
            }))
        }
        Ok(None) => {
            HttpResponse::Unauthorized().json(ApiResponse::<()>::err("Invalid credentials"))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// POST /api/auth/refresh
/// Issue a new JWT if the current token is still valid or expired within the grace period.
#[post("/refresh")]
pub async fn refresh_token(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> HttpResponse {
    let secret = jwt_secret();

    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok());

    let token = match auth_header {
        Some(h) if h.starts_with("Bearer ") => &h[7..],
        _ => {
            return HttpResponse::Unauthorized()
                .json(ApiResponse::<()>::err("Missing or invalid Authorization header"));
        }
    };

    // First try normal decode (token still valid)
    let claims = match crate::auth::decode_jwt(token, &secret) {
        Ok(c) => c,
        Err(_) => {
            // Token may be expired — try decoding without expiry validation
            match crate::auth::decode_jwt_allow_expired(token, &secret) {
                Ok(c) => {
                    let now = chrono::Utc::now().timestamp();
                    // Check if within grace period
                    if now - c.exp > REFRESH_GRACE_PERIOD_SECS {
                        return HttpResponse::Unauthorized()
                            .json(ApiResponse::<()>::err("Token expired beyond grace period. Please log in again."));
                    }
                    c
                }
                Err(_) => {
                    return HttpResponse::Unauthorized()
                        .json(ApiResponse::<()>::err("Invalid token"));
                }
            }
        }
    };

    let user_id: uuid::Uuid = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized()
                .json(ApiResponse::<()>::err("Invalid token: bad user ID"));
        }
    };

    // Verify user still exists
    let row = sqlx::query("SELECT id, email, name FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await;

    match row {
        Ok(Some(row)) => {
            let email: String = row.get("email");
            let name: Option<String> = row.get("name");

            let new_token = match crate::auth::encode_jwt(user_id, &email, &secret) {
                Ok(t) => t,
                Err(e) => {
                    return HttpResponse::InternalServerError()
                        .json(ApiResponse::<()>::err(format!("Token generation failed: {e}")));
                }
            };

            info!("Token refreshed for user: {} ({})", email, user_id);

            HttpResponse::Ok().json(ApiResponse::ok(AuthResponse {
                token: new_token,
                user: UserInfo {
                    id: user_id,
                    email,
                    name,
                },
            }))
        }
        Ok(None) => {
            HttpResponse::Unauthorized().json(ApiResponse::<()>::err("User no longer exists"))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}
