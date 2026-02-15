import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentItemEntity } from '../entities/content-item.entity';

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
export class ContentService implements OnModuleInit {
  private readonly logger = new Logger(ContentService.name);
  private readonly contentStore = new Map<string, ContentItem[]>();

  constructor(
    @InjectRepository(ContentItemEntity)
    private readonly contentRepo: Repository<ContentItemEntity>,
  ) {}

  /**
   * On startup, hydrate the in-memory content store from the database
   * so the system has warm data immediately.
   */
  async onModuleInit() {
    try {
      const items = await this.contentRepo.find();
      for (const item of items) {
        const existing = this.contentStore.get(item.platform) ?? [];
        existing.push(this.entityToContentItem(item));
        this.contentStore.set(item.platform, existing);
      }
      this.logger.log(`Hydrated ${items.length} content items from database`);
    } catch (error) {
      this.logger.warn(
        `Failed to hydrate content from database: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

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

    // Deduplicate across platforms
    allItems = this.deduplicateContent(allItems);

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
   * Deduplicate content across all platforms.
   * Identifies duplicates by normalized URL and title similarity.
   * Keeps the item with the highest score and adds a crossPostedFrom metadata field.
   */
  deduplicateContent(items: ContentItem[]): ContentItem[] {
    const normalizeUrl = (url: string): string => {
      try {
        const u = new URL(url);
        // Strip common tracking params
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
         'ref', 'source', 'fbclid', 'gclid'].forEach(p => u.searchParams.delete(p));
        // Normalize: lowercase host, remove trailing slash
        return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
      } catch {
        return url.toLowerCase().replace(/\/+$/, '');
      }
    };

    const wordOverlap = (a: string, b: string): number => {
      const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
      const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
      if (wordsA.size === 0 || wordsB.size === 0) return 0;
      let intersection = 0;
      for (const w of wordsA) {
        if (wordsB.has(w)) intersection++;
      }
      return intersection / Math.min(wordsA.size, wordsB.size);
    };

    const result: ContentItem[] = [];
    const urlIndex = new Map<string, number>(); // normalizedUrl -> index in result

    for (const item of items) {
      const normUrl = normalizeUrl(item.url);
      const existingIdx = urlIndex.get(normUrl);

      if (existingIdx !== undefined) {
        // URL match -- merge
        const existing = result[existingIdx];
        if ((item.score ?? 0) > (existing.score ?? 0)) {
          // New item has higher score, replace but keep cross-post info
          const crossPosted = [
            ...(existing.metadata?.crossPostedFrom as string[] || []),
            existing.platform,
          ];
          result[existingIdx] = {
            ...item,
            metadata: { ...item.metadata, crossPostedFrom: crossPosted },
          };
        } else {
          // Existing has higher score, add cross-post info
          const crossPosted = [
            ...(existing.metadata?.crossPostedFrom as string[] || []),
            item.platform,
          ];
          result[existingIdx] = {
            ...existing,
            metadata: { ...existing.metadata, crossPostedFrom: crossPosted },
          };
        }
        continue;
      }

      // Check title similarity against all existing items
      let merged = false;
      for (let i = 0; i < result.length; i++) {
        if (item.platform === result[i].platform) continue;
        if (wordOverlap(item.title, result[i].title) > 0.8) {
          const existing = result[i];
          if ((item.score ?? 0) > (existing.score ?? 0)) {
            const crossPosted = [
              ...(existing.metadata?.crossPostedFrom as string[] || []),
              existing.platform,
            ];
            result[i] = {
              ...item,
              metadata: { ...item.metadata, crossPostedFrom: crossPosted },
            };
          } else {
            const crossPosted = [
              ...(existing.metadata?.crossPostedFrom as string[] || []),
              item.platform,
            ];
            result[i] = {
              ...existing,
              metadata: { ...existing.metadata, crossPostedFrom: crossPosted },
            };
          }
          merged = true;
          break;
        }
      }

      if (!merged) {
        urlIndex.set(normUrl, result.length);
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Store normalized content for a given platform.
   * Uses write-through pattern: updates in-memory store and persists to DB.
   */
  async setContentForPlatform(platform: string, items: ContentItem[]): Promise<void> {
    this.contentStore.set(platform, items);
    this.logger.log(
      `Stored ${items.length} content items for platform: ${platform}`,
    );

    // Persist to DB (upsert by id)
    try {
      const entities = items.map((item) => ({
        id: item.id,
        platform,
        contentType: item.contentType,
        title: item.title,
        description: item.description ?? undefined,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl ?? undefined,
        author: item.author,
        authorUrl: item.authorUrl ?? undefined,
        score: item.score ?? undefined,
        commentCount: item.commentCount ?? undefined,
        publishedAt: item.publishedAt,
        fetchedAt: item.fetchedAt,
        metadata: item.metadata ?? undefined,
      }));
      if (entities.length > 0) {
        await this.contentRepo.upsert(entities, ['id']);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to persist content to database: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

  private entityToContentItem(entity: ContentItemEntity): ContentItem {
    return {
      id: entity.id,
      platform: entity.platform,
      contentType: entity.contentType,
      title: entity.title,
      description: entity.description,
      url: entity.url,
      thumbnailUrl: entity.thumbnailUrl,
      author: entity.author,
      authorUrl: entity.authorUrl,
      score: entity.score,
      commentCount: entity.commentCount,
      publishedAt: entity.publishedAt,
      fetchedAt: entity.fetchedAt,
      metadata: entity.metadata,
    };
  }
}
