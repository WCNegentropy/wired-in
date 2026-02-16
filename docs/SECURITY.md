# Wired-In Security

This document covers the security architecture of the Wired-In platform.

## Authentication

### JWT Token Flow

1. **Register** — `POST /api/auth/register` with email + password. Returns a JWT token.
2. **Login** — `POST /api/auth/login` with email + password. Returns a JWT token.
3. **Use** — Include `Authorization: Bearer <token>` header on all authenticated requests.
4. **Refresh** — `POST /api/auth/refresh` with an expired token (within 15-minute grace period). Returns a new token.
5. **Expiry** — Tokens expire after 24 hours. The dashboard auto-refreshes tokens within 5 minutes of expiry.

### JWT Claims

```json
{
  "sub": "<user_id>",
  "email": "<user_email>",
  "exp": "<unix_timestamp (24h from issue)>",
  "iat": "<unix_timestamp>"
}
```

### Password Hashing

Passwords are hashed using **Argon2** (via the `argon2` Rust crate) before storage. Plaintext passwords are never stored or logged.

## OAuth2

### Supported Providers

- **GitHub** — OAuth2 authorization code flow
- **Google** — OAuth2 authorization code flow

### Flow

1. Client requests `GET /api/auth/oauth/{provider}` — gateway generates a random `state` parameter and returns the authorization URL.
2. User authorizes in the provider's UI and is redirected back with `code` and `state`.
3. Client sends `POST /api/auth/oauth/{provider}/callback` with `code` and `state`.
4. Gateway validates `state`, exchanges `code` for an access token, fetches user profile, and creates or links the account.
5. Returns a JWT token.

### Configuration

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `OAUTH_REDIRECT_URI` | Redirect URI registered with providers |

## Encryption at Rest

### API Key Storage (AES-256-GCM)

User-provided platform API keys (YouTube, X, NewsAPI) can be encrypted at rest in PostgreSQL.

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key size:** 256 bits (32 bytes, provided as 64 hex characters)
- **Nonce:** 12 bytes, randomly generated per encryption operation
- **Storage format:** Base64-encoded `nonce || ciphertext`
- **Configuration:** Set `ENCRYPTION_KEY` environment variable

```bash
# Generate a key
openssl rand -hex 32
```

When `ENCRYPTION_KEY` is not set, API keys are stored in plaintext. The `encrypted` flag on each key record indicates whether the value is encrypted.

### Key Masking

API key values are always masked in API responses (e.g., `****...abcd`). Full values are only sent to downstream workers via the `X-Platform-Api-Key` header when proxying feed requests.

## Rate Limiting

The gateway enforces per-user rate limits using a **token bucket** algorithm (in-memory).

| Endpoint Group | Limit | Scope |
|----------------|-------|-------|
| Auth (`/api/auth/*`) | 10 requests/min | Per IP |
| API (`/api/*`) | 100 requests/min | Per user |
| Proxy (`/api/feeds/*`, `/api/content`, `/api/search`) | 30 requests/min | Per user |

When the limit is exceeded, the gateway returns `429 Too Many Requests`.

## CORS

The gateway applies CORS headers based on the `CORS_ALLOWED_ORIGINS` environment variable.

- **Format:** Comma-separated list of allowed origins, or `*` for all origins
- **Default:** Permissive (all origins allowed)
- **Recommended for production:** `CORS_ALLOWED_ORIGINS=https://yourdomain.com`

## Database Security

- **Connection:** PostgreSQL connections use the `DATABASE_URL` connection string. Use SSL in production.
- **Migrations:** 10 SQL migrations run automatically on gateway startup.
- **User data isolation:** All queries are scoped to the authenticated `user_id` — users cannot access other users' workspaces, tiles, bookmarks, etc.

## Workspace Sharing

- Share tokens are randomly generated UUIDs.
- Share links can have expiration times (1h, 24h, 7d, 30d, or never).
- Shared workspaces are read-only for viewers.
- Share links can be revoked at any time by the workspace owner.
- The public endpoint `GET /api/shared/{token}` does not require authentication.

## Recommendations for Production

1. **Set a strong `JWT_SECRET`** — Use at least 32 random bytes (`openssl rand -hex 32`).
2. **Set `ENCRYPTION_KEY`** — Enable API key encryption at rest.
3. **Restrict CORS origins** — Set `CORS_ALLOWED_ORIGINS` to your dashboard domain.
4. **Use SSL/TLS** — Terminate TLS at a reverse proxy (nginx, Caddy) in front of the gateway.
5. **Secure database connections** — Use `?sslmode=require` in `DATABASE_URL`.
6. **Rotate secrets** — Periodically rotate `JWT_SECRET` and `ENCRYPTION_KEY` (re-encrypt keys after rotation).
7. **Use non-default credentials** — Change the default PostgreSQL password in `DATABASE_URL`.
