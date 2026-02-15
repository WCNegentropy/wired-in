import { useEffect, useRef } from 'react';
import { createSSEConnection } from '../lib/api';
import { useWiredInStore } from '../store';
import type { ContentItem } from '../types';

export function useSSE(workspaceId: string | null) {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const es = createSSEConnection(workspaceId, () => {});
    esRef.current = es;

    const handleContent = (event: Event) => {
      const messageEvent = event as MessageEvent;
      try {
        const data = JSON.parse(messageEvent.data) as {
          platform: string;
          items: ContentItem[];
        };

        const state = useWiredInStore.getState();
        const activeWs = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
        if (!activeWs) return;

        const matchingTiles = activeWs.tiles.filter((t) => t.platform === data.platform);
        for (const tile of matchingTiles) {
          const maxItems = tile.config.maxItems ?? 10;
          state.setTileContent(tile.id, data.items.slice(0, maxItems));
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.addEventListener('content', handleContent);

    return () => {
      es.removeEventListener('content', handleContent);
      es.close();
      esRef.current = null;
    };
  }, [workspaceId]);
}
