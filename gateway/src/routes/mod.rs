pub mod analytics;
pub mod api_keys;
pub mod auth;
pub mod bookmarks;
pub mod helpers;
pub mod import_export;
pub mod oauth;
pub mod proxy;
pub mod saved_searches;
pub mod shares;
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
                    .service(auth::login)
                    .service(auth::refresh_token)
                    // OAuth routes
                    .service(
                        web::scope("/oauth")
                            .service(oauth::oauth_redirect)
                            .service(oauth::oauth_callback),
                    ),
            )
            // Proxy routes (feeds, content, search)
            .service(proxy::get_feeds_status)
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
            // Import/Export
            .service(import_export::export_workspace)
            .service(import_export::export_all_workspaces)
            .service(import_export::import_workspaces)
            .service(import_export::import_opml)
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
            .service(user::update_preferences)
            // Bookmarks
            .service(bookmarks::list_bookmarks)
            .service(bookmarks::create_bookmark)
            .service(bookmarks::update_bookmark)
            .service(bookmarks::delete_bookmark)
            .service(bookmarks::check_bookmarked)
            // Saved Searches
            .service(saved_searches::list_searches)
            .service(saved_searches::create_search)
            .service(saved_searches::update_search)
            .service(saved_searches::delete_search)
            // Analytics
            .service(analytics::track_click)
            .service(analytics::get_workspace_analytics)
            .service(analytics::export_analytics_csv)
            // Workspace shares
            .service(shares::create_share_link)
            .service(shares::revoke_share_link)
            .service(shares::list_share_links)
            // Public shared workspace endpoint
            .service(shares::get_shared_workspace),
    );
}
