use actix_web::error::ErrorUnauthorized;
use actix_web::{dev::Payload, FromRequest, HttpRequest};
use std::future::{ready, Ready};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: Uuid,
    pub email: String,
}

impl FromRequest for AuthenticatedUser {
    type Error = actix_web::Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "dev-secret-change-me".to_string());

        let auth_header = req
            .headers()
            .get("Authorization")
            .and_then(|v| v.to_str().ok());

        let token = match auth_header {
            Some(h) if h.starts_with("Bearer ") => &h[7..],
            _ => {
                return ready(Err(ErrorUnauthorized("Missing or invalid Authorization header")));
            }
        };

        match crate::auth::decode_jwt(token, &secret) {
            Ok(claims) => match claims.sub.parse::<Uuid>() {
                Ok(user_id) => ready(Ok(AuthenticatedUser {
                    user_id,
                    email: claims.email,
                })),
                Err(_) => ready(Err(ErrorUnauthorized("Invalid token: bad user ID"))),
            },
            Err(_) => ready(Err(ErrorUnauthorized("Invalid or expired token"))),
        }
    }
}
