const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080';

export async function fetchFeed(platform: string, config: Record<string, string>): Promise<unknown[]> {
  const params = new URLSearchParams(config);
  const res = await fetch(`${GATEWAY_URL}/api/feeds/${platform}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch ${platform} feed`);
  const data = await res.json();
  return data.items ?? data;
}

export async function searchPlatform(platform: string, query: string): Promise<unknown[]> {
  const res = await fetch(`${GATEWAY_URL}/api/feeds/${platform}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Search failed for ${platform}`);
  const data = await res.json();
  return data.items ?? data;
}

export async function fetchPlatforms(): Promise<string[]> {
  const res = await fetch(`${GATEWAY_URL}/api/feeds/platforms`);
  if (!res.ok) return ['reddit', 'youtube', 'x', 'rss', 'news'];
  const data = await res.json();
  return data.platforms ?? [];
}

export function createSSEConnection(workspaceId: string, onMessage: (event: MessageEvent) => void): EventSource {
  const es = new EventSource(`${GATEWAY_URL}/api/stream?workspace_id=${workspaceId}`);
  es.onmessage = onMessage;
  return es;
}
