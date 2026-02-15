pub mod proxy;
pub mod stream;
pub mod tiles;
pub mod workspaces;

use actix_web::web;

/// Mount every route group onto the Actix `App` service config.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
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
            // Tile configuration
            .service(tiles::list_tiles)
            .service(tiles::create_tile)
            .service(tiles::update_tile)
            .service(tiles::delete_tile)
            // SSE streaming
            .service(stream::event_stream),
    );
}
