use log::info;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;

pub async fn init_redis(redis_url: &str) -> ConnectionManager {
    let client = redis::Client::open(redis_url).expect("Invalid REDIS_URL");
    let conn = ConnectionManager::new(client)
        .await
        .expect("Failed to connect to Redis");
    info!("Connected to Redis");
    conn
}

pub async fn create_pubsub(redis_url: &str) -> Result<redis::aio::PubSub, redis::RedisError> {
    let client = redis::Client::open(redis_url)?;
    let conn = client.get_async_connection().await?;
    Ok(conn.into_pubsub())
}

pub async fn get_cached(conn: &mut ConnectionManager, key: &str) -> Option<String> {
    let result: Option<String> = conn.get(key).await.ok()?;
    result
}

pub async fn set_cached(
    conn: &mut ConnectionManager,
    key: &str,
    value: &str,
    ttl_secs: u64,
) -> Result<(), redis::RedisError> {
    conn.set_ex(key, value, ttl_secs).await
}
