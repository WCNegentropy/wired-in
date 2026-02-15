use actix_web::{get, web, HttpResponse};
use chrono::Utc;
use futures::StreamExt;
use log::{error, info};
use serde::Deserialize;
use std::time::Duration;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct StreamQuery {
    pub workspace_id: Option<String>,
}

/// GET /api/stream?workspace_id=xxx
///
/// Server-Sent Events endpoint for real-time content updates.
/// Subscribes to Redis pub/sub for feed updates and emits heartbeats.
#[get("/stream")]
pub async fn event_stream(
    _state: web::Data<AppState>,
    query: web::Query<StreamQuery>,
) -> HttpResponse {
    let workspace_id = query
        .workspace_id
        .clone()
        .unwrap_or_else(|| "default".to_string());

    info!("SSE client connected for workspace {}", workspace_id);

    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());

    // Try to set up Redis pub/sub
    let pubsub_result = crate::cache::create_pubsub(&redis_url).await;

    let event_stream = match pubsub_result {
        Ok(mut pubsub) => {
            // Subscribe to feed update channels
            if let Err(e) = pubsub.psubscribe("feed:updates:*").await {
                error!("Failed to psubscribe to feed:updates:*: {}", e);
            }

            let ws_id = workspace_id.clone();
            let msg_stream = pubsub.into_on_message();

            let stream = async_stream::stream! {
                let mut heartbeat_interval = tokio::time::interval(Duration::from_secs(15));
                let mut messages = msg_stream;

                loop {
                    tokio::select! {
                        msg = messages.next() => {
                            match msg {
                                Some(msg) => {
                                    let payload: String = match redis::from_redis_value(&msg.get_payload_bytes().into()) {
                                        Ok(s) => s,
                                        Err(_) => match msg.get_payload::<String>() {
                                            Ok(s) => s,
                                            Err(_) => continue,
                                        }
                                    };
                                    let data = format!("event: content\ndata: {}\n\n", payload);
                                    yield Ok::<_, actix_web::Error>(bytes::Bytes::from(data));
                                }
                                None => break,
                            }
                        }
                        _ = heartbeat_interval.tick() => {
                            let heartbeat = format!(
                                "event: heartbeat\ndata: {}\n\n",
                                serde_json::json!({
                                    "type": "heartbeat",
                                    "workspace_id": ws_id,
                                    "timestamp": Utc::now().to_rfc3339(),
                                })
                            );
                            yield Ok::<_, actix_web::Error>(bytes::Bytes::from(heartbeat));
                        }
                    }
                }
            };

            Box::pin(stream) as std::pin::Pin<Box<dyn futures::Stream<Item = Result<bytes::Bytes, actix_web::Error>>>>
        }
        Err(e) => {
            error!("Failed to create Redis pub/sub connection: {}, falling back to heartbeat-only mode", e);

            let ws_id = workspace_id.clone();
            let stream = async_stream::stream! {
                loop {
                    tokio::time::sleep(Duration::from_secs(15)).await;
                    let heartbeat = format!(
                        "event: heartbeat\ndata: {}\n\n",
                        serde_json::json!({
                            "type": "heartbeat",
                            "workspace_id": ws_id,
                            "timestamp": Utc::now().to_rfc3339(),
                        })
                    );
                    yield Ok::<_, actix_web::Error>(bytes::Bytes::from(heartbeat));
                }
            };

            Box::pin(stream)
        }
    };

    HttpResponse::Ok()
        .insert_header(("Content-Type", "text/event-stream"))
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("Connection", "keep-alive"))
        .insert_header(("X-Accel-Buffering", "no"))
        .streaming(event_stream)
}
