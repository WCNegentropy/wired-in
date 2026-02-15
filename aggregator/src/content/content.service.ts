import { Injectable, Logger } from '@nestjs/common';

export interface ContentItem {
  id: string;
  platform: string;
  contentType: string;
  title: string;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  author: string;
  authorUrl: string | null;
  score: number | null;
  commentCount: number | null;
  publishedAt: string;
  fetchedAt: string;
  metadata: Record<string, any> | null;
}

export interface AggregateOptions {
  limit: number;
  offset: number;
  platforms?: string[];
  sort: 'date' | 'score' | 'relevance';
  query?: string;
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);
  private readonly contentStore = new Map<string, ContentItem[]>();

  /**
   * Combine content from all platforms, apply filters and sorting.
   */
  aggregateContent(options: AggregateOptions): {
    items: ContentItem[];
    total: number;
  } {
    const { limit, offset, platforms, sort, query } = options;

    let allItems: ContentItem[] = [];

    if (platforms && platforms.length > 0) {
      for (const platform of platforms) {
        const items = this.contentStore.get(platform) || [];
        allItems = allItems.concat(items);
      }
    } else {
      for (const items of this.contentStore.values()) {
        allItems = allItems.concat(items);
      }
    }

    // Apply search filter if query is provided
    if (query) {
      const lowerQuery = query.toLowerCase();
      allItems = allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(lowerQuery) ||
          (item.description &&
            item.description.toLowerCase().includes(lowerQuery)) ||
          item.author.toLowerCase().includes(lowerQuery),
      );
    }

    // Sort
    allItems = this.sortItems(allItems, sort, query);

    const total = allItems.length;
    const items = allItems.slice(offset, offset + limit);

    return { items, total };
  }

  /**
   * Transform raw platform data into the unified ContentItem format.
   */
  normalizeContent(rawItems: any[], platform: string): ContentItem[] {
    const now = new Date().toISOString();

    return rawItems.map((raw) => ({
      id: raw.id || `${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      platform,
      contentType: raw.contentType || raw.type || 'post',
      title: raw.title || raw.name || '',
      description: raw.description || raw.body || raw.text || null,
      url: raw.url || raw.link || '',
      thumbnailUrl: raw.thumbnailUrl || raw.thumbnail || raw.image || null,
      author: raw.author || raw.user || raw.username || 'unknown',
      authorUrl: raw.authorUrl || raw.userUrl || null,
      score: raw.score ?? raw.likes ?? raw.upvotes ?? null,
      commentCount: raw.commentCount ?? raw.comments ?? null,
      publishedAt: raw.publishedAt || raw.createdAt || raw.date || now,
      fetchedAt: now,
      metadata: raw.metadata || null,
    }));
  }

  /**
   * Full-text search across cached content from specified platforms.
   */
  searchContent(
    query: string,
    platforms?: string[],
  ): ContentItem[] {
    const lowerQuery = query.toLowerCase();
    let allItems: ContentItem[] = [];

    if (platforms && platforms.length > 0) {
      for (const platform of platforms) {
        const items = this.contentStore.get(platform) || [];
        allItems = allItems.concat(items);
      }
    } else {
      for (const items of this.contentStore.values()) {
        allItems = allItems.concat(items);
      }
    }

    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        (item.description &&
          item.description.toLowerCase().includes(lowerQuery)) ||
        item.author.toLowerCase().includes(lowerQuery) ||
        item.platform.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Store normalized content for a given platform.
   */
  setContentForPlatform(platform: string, items: ContentItem[]): void {
    this.contentStore.set(platform, items);
    this.logger.log(
      `Stored ${items.length} content items for platform: ${platform}`,
    );
  }

  /**
   * Retrieve content for a specific platform from the in-memory store.
   */
  getContentForPlatform(platform: string): ContentItem[] {
    return this.contentStore.get(platform) || [];
  }

  /**
   * Get all registered platform names.
   */
  getRegisteredPlatforms(): string[] {
    return Array.from(this.contentStore.keys());
  }

  private sortItems(
    items: ContentItem[],
    sort: 'date' | 'score' | 'relevance',
    query?: string,
  ): ContentItem[] {
    switch (sort) {
      case 'score':
        return items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      case 'relevance':
        if (query) {
          const lowerQuery = query.toLowerCase();
          return items.sort((a, b) => {
            const aRelevance = this.computeRelevance(a, lowerQuery);
            const bRelevance = this.computeRelevance(b, lowerQuery);
            return bRelevance - aRelevance;
          });
        }
        // Fall through to date sort if no query
        return items.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime(),
        );
      case 'date':
      default:
        return items.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime(),
        );
    }
  }

  private computeRelevance(item: ContentItem, query: string): number {
    let score = 0;
    if (item.title.toLowerCase().includes(query)) score += 10;
    if (item.description?.toLowerCase().includes(query)) score += 5;
    if (item.author.toLowerCase().includes(query)) score += 3;
    score += item.score ?? 0;
    return score;
  }
}
