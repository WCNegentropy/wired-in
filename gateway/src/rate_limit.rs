use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

/// Simple in-memory token bucket rate limiter.
pub struct RateLimiter {
    buckets: Mutex<HashMap<String, Bucket>>,
}

struct Bucket {
    tokens: f64,
    max_tokens: f64,
    refill_rate: f64, // tokens per second
    last_refill: Instant,
}

impl Bucket {
    fn new(max_tokens: f64, refill_rate: f64) -> Self {
        Self {
            tokens: max_tokens,
            max_tokens,
            refill_rate,
            last_refill: Instant::now(),
        }
    }

    fn try_consume(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.max_tokens);
        self.last_refill = now;

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            buckets: Mutex::new(HashMap::new()),
        }
    }

    /// Check rate limit. Returns true if the request is allowed.
    /// `key` is typically "auth:{ip}", "api:{user_id}", or "proxy:{user_id}".
    /// `max_per_minute` is the maximum requests per minute.
    pub fn check(&self, key: &str, max_per_minute: u32) -> bool {
        let mut buckets = self.buckets.lock().unwrap();
        let refill_rate = max_per_minute as f64 / 60.0;
        let max_tokens = max_per_minute as f64;

        let bucket = buckets
            .entry(key.to_string())
            .or_insert_with(|| Bucket::new(max_tokens, refill_rate));

        // Update bucket params if they've changed
        if (bucket.max_tokens - max_tokens).abs() > 0.01 {
            bucket.max_tokens = max_tokens;
            bucket.refill_rate = refill_rate;
        }

        bucket.try_consume()
    }
}
