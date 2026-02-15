pub mod api_keys;
pub mod auth;
pub mod helpers;
pub mod proxy;
pub mod stream;
pub mod tiles;
pub mod user;
pub mod workspaces;

use actix_web::web;

/// Mount every route group onto the Actix `App` service config.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            // Auth routes
            .service(
                web::scope("/auth")
                    .service(auth::register)
                    .service(auth::login),
            )
            // Proxy routes (feeds, content, search)
            .service(proxy::get_feeds)
            .service(proxy::get_content)
            .service(proxy::search_content)
            .service(proxy::subscribe_feed)
            // Workspace CRUD
            .service(workspaces::list_workspaces)
            .service(workspaces::create_workspace)
            .service(workspaces::get_workspace)
            .service(workspaces::update_workspace)
            .service(workspaces::delete_workspace)
            .service(workspaces::batch_update_tile_positions)
            // Tile configuration
            .service(tiles::list_tiles)
            .service(tiles::create_tile)
            .service(tiles::update_tile)
            .service(tiles::delete_tile)
            // SSE streaming
            .service(stream::event_stream)
            // API key management
            .service(api_keys::list_keys)
            .service(api_keys::create_key)
            .service(api_keys::update_key)
            .service(api_keys::delete_key)
            // User preferences
            .service(user::get_preferences)
            .service(user::update_preferences),
    );
}
