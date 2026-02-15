use actix_web::{get, web, HttpResponse};
use chrono::Utc;
use futures::stream;
use log::info;
use serde::Deserialize;
use std::time::Duration;

use crate::models::ContentEvent;

#[derive(Debug, Deserialize)]
pub struct StreamQuery {
    pub workspace_id: Option<String>,
}

/// GET /api/stream?workspace_id=xxx
///
/// Server-Sent Events endpoint for real-time content updates.
/// Emits periodic heartbeat events and content update events.
#[get("/stream")]
pub async fn event_stream(query: web::Query<StreamQuery>) -> HttpResponse {
    let workspace_id = query
        .workspace_id
        .clone()
        .unwrap_or_else(|| "default".to_string());

    info!("SSE client connected for workspace {}", workspace_id);

    // Build an async stream that yields SSE-formatted bytes.
    let event_stream = stream::unfold(0u64, move |tick| {
        let ws_id = workspace_id.clone();
        async move {
            // Wait between events.
            tokio::time::sleep(Duration::from_secs(5)).await;

            let payload = if tick % 6 == 0 {
                // Every 30 seconds send a heartbeat.
                format!(
                    "event: heartbeat\ndata: {}\n\n",
                    serde_json::json!({
                        "type": "heartbeat",
                        "workspace_id": ws_id,
                        "timestamp": Utc::now().to_rfc3339(),
                    })
                )
            } else {
                // Send a content update event.
                let event = ContentEvent {
                    platform: "system".to_string(),
                    content_type: "update".to_string(),
                    data: serde_json::json!({
                        "workspace_id": ws_id,
                        "tick": tick,
                        "message": "Waiting for content updates",
                    }),
                    timestamp: Utc::now(),
                };
                format!(
                    "event: content\ndata: {}\n\n",
                    serde_json::to_string(&event).unwrap_or_default()
                )
            };

            let bytes = bytes::Bytes::from(payload);
            Some((Ok::<_, actix_web::Error>(bytes), tick + 1))
        }
    });

    HttpResponse::Ok()
        .insert_header(("Content-Type", "text/event-stream"))
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("Connection", "keep-alive"))
        .insert_header(("X-Accel-Buffering", "no"))
        .streaming(Box::pin(event_stream))
}
