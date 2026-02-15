import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '../cache/cache.service';
import { ContentService, ContentItem } from '../content/content.service';

interface PlatformConfig {
  name: string;
  endpoint: string;
  cacheTtl: number; // seconds
}

const DEFAULT_PLATFORMS: PlatformConfig[] = [
  { name: 'reddit', endpoint: '/api/feeds/reddit', cacheTtl: 300 },
  { name: 'hackernews', endpoint: '/api/feeds/hackernews', cacheTtl: 300 },
  { name: 'github', endpoint: '/api/feeds/github', cacheTtl: 600 },
  { name: 'devto', endpoint: '/api/feeds/devto', cacheTtl: 300 },
  { name: 'producthunt', endpoint: '/api/feeds/producthunt', cacheTtl: 600 },
];

@Injectable()
export class FeedsService {
  private readonly logger = new Logger(FeedsService.name);
  private readonly workersUrl: string;
  private readonly platforms: PlatformConfig[];

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly contentService: ContentService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.workersUrl = this.configService.get<string>(
      'WORKERS_URL',
      'http://localhost:8000',
    );
    this.platforms = DEFAULT_PLATFORMS;
  }

  /**
   * Fetch a feed from the workers service, normalize it, and cache the result.
   */
  async fetchFeed(platform: string): Promise<ContentItem[]> {
    const cacheKey = `feed:${platform}`;

    // Check cache first
    const cached = this.cacheService.get<ContentItem[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for platform: ${platform}`);
      return cached;
    }

    const config = this.platforms.find((p) => p.name === platform);
    const endpoint = config
      ? config.endpoint
      : `/api/feeds/${platform}`;
    const ttl = config ? config.cacheTtl : 300;

    try {
      const url = `${this.workersUrl}${endpoint}`;
      this.logger.log(`Fetching feed from workers: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn(
          `Workers returned ${response.status} for ${platform}`,
        );
        return [];
      }

      const rawData = await response.json();
      const rawItems = Array.isArray(rawData)
        ? rawData
        : rawData.items || rawData.data || [];

      // Normalize the content
      const normalized = this.contentService.normalizeContent(
        rawItems,
        platform,
      );

      // Cache the result
      this.cacheService.set(cacheKey, normalized, ttl);

      // Store in the content service for aggregation
      this.contentService.setContentForPlatform(platform, normalized);

      // Emit event
      this.eventEmitter.emit('feed.fetched', {
        platform,
        count: normalized.length,
      });

      return normalized;
    } catch (error) {
      this.logger.error(
        `Failed to fetch feed for ${platform}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return whatever we have in the content store as fallback
      return this.contentService.getContentForPlatform(platform);
    }
  }

  /**
   * Search a specific platform feed.
   */
  async searchPlatformFeed(
    platform: string,
    query: string,
  ): Promise<ContentItem[]> {
    // Ensure we have the latest feed data
    await this.fetchFeed(platform);
    return this.contentService.searchContent(query, [platform]);
  }

  /**
   * Get list of available platforms.
   */
  getAvailablePlatforms(): { name: string; cacheTtl: number }[] {
    return this.platforms.map((p) => ({
      name: p.name,
      cacheTtl: p.cacheTtl,
    }));
  }

  /**
   * Force refresh all registered feeds.
   */
  async refreshAll(): Promise<{
    results: { platform: string; count: number; error?: string }[];
  }> {
    this.logger.log('Refreshing all feeds...');

    const results: { platform: string; count: number; error?: string }[] = [];

    // Invalidate cache for all platforms
    for (const platform of this.platforms) {
      this.cacheService.delete(`feed:${platform.name}`);
    }

    // Fetch all feeds in parallel
    const promises = this.platforms.map(async (platform) => {
      try {
        const items = await this.fetchFeed(platform.name);
        results.push({ platform: platform.name, count: items.length });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        results.push({ platform: platform.name, count: 0, error: message });
      }
    });

    await Promise.allSettled(promises);

    this.eventEmitter.emit('feeds.refreshed', { results });
    this.logger.log(`Feed refresh complete. ${results.length} platforms processed.`);

    return { results };
  }
}
