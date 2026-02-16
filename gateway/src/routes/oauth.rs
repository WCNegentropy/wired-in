use actix_web::{get, post, web, HttpResponse};
use log::{error, info};
use rand::Rng;
use redis::AsyncCommands;
use sqlx::Row;
use uuid::Uuid;

use crate::models::{ApiResponse, AuthResponse, OAuthCallbackRequest, OAuthUrlResponse, UserInfo};
use crate::state::AppState;

/// Generate a random hex string for the OAuth state parameter.
fn generate_state() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    hex::encode(bytes)
}

fn jwt_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".to_string())
}

/// GET /api/auth/oauth/{provider}
/// Generate an OAuth redirect URL for the given provider.
#[get("/{provider}")]
pub async fn oauth_redirect(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let provider = path.into_inner();

    let (client_id, authorize_url, scope) = match provider.as_str() {
        "github" => {
            let client_id = match std::env::var("GITHUB_CLIENT_ID") {
                Ok(v) => v,
                Err(_) => {
                    return HttpResponse::NotImplemented()
                        .json(ApiResponse::<()>::err("GitHub OAuth not configured"));
                }
            };
            // Verify secret is also set
            if std::env::var("GITHUB_CLIENT_SECRET").is_err() {
                return HttpResponse::NotImplemented()
                    .json(ApiResponse::<()>::err("GitHub OAuth not configured"));
            }
            (
                client_id,
                "https://github.com/login/oauth/authorize".to_string(),
                "read:user user:email".to_string(),
            )
        }
        "google" => {
            let client_id = match std::env::var("GOOGLE_CLIENT_ID") {
                Ok(v) => v,
                Err(_) => {
                    return HttpResponse::NotImplemented()
                        .json(ApiResponse::<()>::err("Google OAuth not configured"));
                }
            };
            if std::env::var("GOOGLE_CLIENT_SECRET").is_err() {
                return HttpResponse::NotImplemented()
                    .json(ApiResponse::<()>::err("Google OAuth not configured"));
            }
            (
                client_id,
                "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
                "openid email profile".to_string(),
            )
        }
        _ => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<()>::err(format!("Unsupported provider: {provider}")));
        }
    };

    let oauth_state = generate_state();

    // Store state in Redis with 600s TTL
    let mut redis = state.redis.clone();
    let redis_key = format!("oauth_state:{oauth_state}");
    if let Err(e) = redis.set_ex::<_, _, ()>(&redis_key, &provider, 600).await {
        error!("Failed to store OAuth state in Redis: {e}");
        return HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err("Failed to initiate OAuth flow"));
    }

    let redirect_uri = std::env::var("OAUTH_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:3000/auth/callback".to_string());

    let url = match provider.as_str() {
        "github" => format!(
            "{authorize_url}?client_id={client_id}&scope={scope}&state={oauth_state}&redirect_uri={redirect_uri}",
        ),
        "google" => format!(
            "{authorize_url}?client_id={client_id}&scope={scope}&state={oauth_state}&redirect_uri={redirect_uri}&response_type=code&access_type=offline",
        ),
        _ => unreachable!(),
    };

    HttpResponse::Ok().json(ApiResponse::ok(OAuthUrlResponse { url }))
}

/// POST /api/auth/oauth/{provider}/callback
/// Handle the OAuth callback: exchange code for token, fetch profile, upsert user.
#[post("/{provider}/callback")]
pub async fn oauth_callback(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<OAuthCallbackRequest>,
) -> HttpResponse {
    let provider = path.into_inner();
    let secret = jwt_secret();

    // Validate state from Redis
    let mut redis = state.redis.clone();
    let redis_key = format!("oauth_state:{}", body.state);
    let stored_provider: Option<String> = match redis.get(&redis_key).await {
        Ok(v) => v,
        Err(e) => {
            error!("Redis error validating OAuth state: {e}");
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Failed to validate OAuth state"));
        }
    };

    match stored_provider {
        Some(ref p) if p == &provider => {
            // Valid state — delete it so it can't be reused
            let _: Result<(), _> = redis.del(&redis_key).await;
        }
        _ => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<()>::err("Invalid or expired OAuth state"));
        }
    }

    // Exchange code for access token and fetch user profile
    let (provider_id, email, name, avatar_url) = match provider.as_str() {
        "github" => match exchange_github(&state.http_client, &body.code).await {
            Ok(profile) => profile,
            Err(e) => {
                error!("GitHub OAuth error: {e}");
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err(format!("GitHub OAuth failed: {e}")));
            }
        },
        "google" => match exchange_google(&state.http_client, &body.code).await {
            Ok(profile) => profile,
            Err(e) => {
                error!("Google OAuth error: {e}");
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err(format!("Google OAuth failed: {e}")));
            }
        },
        _ => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<()>::err(format!("Unsupported provider: {provider}")));
        }
    };

    // Upsert user: check if an oauth_link already exists for this provider+provider_id
    let existing_link = sqlx::query(
        "SELECT user_id FROM oauth_links WHERE provider = $1 AND provider_id = $2",
    )
    .bind(&provider)
    .bind(&provider_id)
    .fetch_optional(&state.db)
    .await;

    let user_id: Uuid = match existing_link {
        Ok(Some(row)) => {
            // Existing OAuth link — update avatar if changed
            let uid: Uuid = row.get("user_id");
            let _ = sqlx::query(
                "UPDATE users SET avatar_url = COALESCE($2, avatar_url), updated_at = NOW() WHERE id = $1",
            )
            .bind(uid)
            .bind(&avatar_url)
            .execute(&state.db)
            .await;

            // Update oauth_links email/avatar
            let _ = sqlx::query(
                "UPDATE oauth_links SET email = $3, avatar_url = $4 WHERE provider = $1 AND provider_id = $2",
            )
            .bind(&provider)
            .bind(&provider_id)
            .bind(&email)
            .bind(&avatar_url)
            .execute(&state.db)
            .await;

            uid
        }
        Ok(None) => {
            // Check if a user with this email already exists
            let existing_user = if let Some(ref em) = email {
                sqlx::query("SELECT id FROM users WHERE email = $1")
                    .bind(em)
                    .fetch_optional(&state.db)
                    .await
                    .unwrap_or(None)
            } else {
                None
            };

            let uid = if let Some(row) = existing_user {
                // Link OAuth to existing user
                let uid: Uuid = row.get("id");
                let _ = sqlx::query(
                    "UPDATE users SET avatar_url = COALESCE($2, avatar_url), auth_provider = $3, updated_at = NOW() WHERE id = $1",
                )
                .bind(uid)
                .bind(&avatar_url)
                .bind(&provider)
                .execute(&state.db)
                .await;
                uid
            } else {
                // Create new user
                let uid = Uuid::new_v4();
                let user_email = email.clone().unwrap_or_else(|| format!("{}@{}.oauth", provider_id, provider));
                let result = sqlx::query(
                    "INSERT INTO users (id, email, password_hash, name, avatar_url, auth_provider) \
                     VALUES ($1, $2, $3, $4, $5, $6)",
                )
                .bind(uid)
                .bind(&user_email)
                .bind("oauth") // No password for OAuth users
                .bind(&name)
                .bind(&avatar_url)
                .bind(&provider)
                .execute(&state.db)
                .await;

                if let Err(e) = result {
                    error!("Failed to create OAuth user: {e}");
                    return HttpResponse::InternalServerError()
                        .json(ApiResponse::<()>::err(format!("Failed to create user: {e}")));
                }
                uid
            };

            // Create the oauth_link
            let link_result = sqlx::query(
                "INSERT INTO oauth_links (user_id, provider, provider_id, email, avatar_url) \
                 VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(uid)
            .bind(&provider)
            .bind(&provider_id)
            .bind(&email)
            .bind(&avatar_url)
            .execute(&state.db)
            .await;

            if let Err(e) = link_result {
                error!("Failed to create OAuth link: {e}");
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::err(format!("Failed to link OAuth account: {e}")));
            }

            uid
        }
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err(format!("Database error: {e}")));
        }
    };

    // Fetch user info for response
    let user_row = sqlx::query("SELECT id, email, name FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await;

    match user_row {
        Ok(Some(row)) => {
            let user_email: String = row.get("email");
            let user_name: Option<String> = row.get("name");

            let token = match crate::auth::encode_jwt(user_id, &user_email, &secret) {
                Ok(t) => t,
                Err(e) => {
                    return HttpResponse::InternalServerError()
                        .json(ApiResponse::<()>::err(format!("Token generation failed: {e}")));
                }
            };

            info!("OAuth login via {}: {} ({})", provider, user_email, user_id);

            HttpResponse::Ok().json(ApiResponse::ok(AuthResponse {
                token,
                user: UserInfo {
                    id: user_id,
                    email: user_email,
                    name: user_name,
                },
            }))
        }
        Ok(None) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err("User not found after OAuth upsert")),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

/// Exchange a GitHub authorization code for an access token and fetch the user profile.
/// Returns (provider_id, email, name, avatar_url).
async fn exchange_github(
    client: &reqwest::Client,
    code: &str,
) -> Result<(String, Option<String>, Option<String>, Option<String>), String> {
    let client_id = std::env::var("GITHUB_CLIENT_ID").map_err(|_| "GITHUB_CLIENT_ID not set")?;
    let client_secret =
        std::env::var("GITHUB_CLIENT_SECRET").map_err(|_| "GITHUB_CLIENT_SECRET not set")?;

    // Exchange code for access token
    let token_resp = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
        }))
        .send()
        .await
        .map_err(|e| format!("Token request failed: {e}"))?;

    let token_json: serde_json::Value = token_resp
        .json()
        .await
        .map_err(|e| format!("Token response parse error: {e}"))?;

    let access_token = token_json["access_token"]
        .as_str()
        .ok_or("No access_token in GitHub response")?
        .to_string();

    // Fetch user profile
    let user_resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {access_token}"))
        .header("User-Agent", "wired-in-gateway")
        .send()
        .await
        .map_err(|e| format!("User profile request failed: {e}"))?;

    let user_json: serde_json::Value = user_resp
        .json()
        .await
        .map_err(|e| format!("User profile parse error: {e}"))?;

    let provider_id = user_json["id"]
        .as_i64()
        .map(|id| id.to_string())
        .ok_or("No id in GitHub user response")?;
    let email = user_json["email"].as_str().map(|s| s.to_string());
    let name = user_json["name"].as_str().map(|s| s.to_string());
    let avatar_url = user_json["avatar_url"].as_str().map(|s| s.to_string());

    Ok((provider_id, email, name, avatar_url))
}

/// Exchange a Google authorization code for an access token and fetch the user profile.
/// Returns (provider_id, email, name, avatar_url).
async fn exchange_google(
    client: &reqwest::Client,
    code: &str,
) -> Result<(String, Option<String>, Option<String>, Option<String>), String> {
    let client_id = std::env::var("GOOGLE_CLIENT_ID").map_err(|_| "GOOGLE_CLIENT_ID not set")?;
    let client_secret =
        std::env::var("GOOGLE_CLIENT_SECRET").map_err(|_| "GOOGLE_CLIENT_SECRET not set")?;
    let redirect_uri = std::env::var("OAUTH_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:3000/auth/callback".to_string());

    // Exchange code for access token
    let token_resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("code", code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("Token request failed: {e}"))?;

    let token_json: serde_json::Value = token_resp
        .json()
        .await
        .map_err(|e| format!("Token response parse error: {e}"))?;

    let access_token = token_json["access_token"]
        .as_str()
        .ok_or("No access_token in Google response")?
        .to_string();

    // Fetch user profile
    let user_resp = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|e| format!("User profile request failed: {e}"))?;

    let user_json: serde_json::Value = user_resp
        .json()
        .await
        .map_err(|e| format!("User profile parse error: {e}"))?;

    let provider_id = user_json["id"]
        .as_str()
        .ok_or("No id in Google user response")?
        .to_string();
    let email = user_json["email"].as_str().map(|s| s.to_string());
    let name = user_json["name"].as_str().map(|s| s.to_string());
    let avatar_url = user_json["picture"].as_str().map(|s| s.to_string());

    Ok((provider_id, email, name, avatar_url))
}
