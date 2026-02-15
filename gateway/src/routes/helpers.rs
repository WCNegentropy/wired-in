use sqlx::Row;

use crate::models::{Platform, Tile, TileConfig, TilePosition};

/// Convert a sqlx Postgres row into a Tile model.
pub fn tile_from_row(row: &sqlx::postgres::PgRow) -> Result<Tile, String> {
    let platform_str: String = row.get("platform");
    let platform: Platform =
        serde_json::from_value(serde_json::Value::String(platform_str.clone()))
            .map_err(|_| format!("Unknown platform: {}", platform_str))?;

    Ok(Tile {
        id: row.get("id"),
        workspace_id: row.get("workspace_id"),
        platform,
        config: TileConfig {
            extra: row.get("config"),
        },
        position: TilePosition {
            x: row.get("position_x"),
            y: row.get("position_y"),
            w: row.get("position_w"),
            h: row.get("position_h"),
        },
        refresh_interval_secs: row.get::<i64, _>("refresh_interval_secs") as u64,
    })
}
