import { Injectable, Inject, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { FeedsService } from '../feeds/feeds.service';
import { CacheService } from '../cache/cache.service';

export interface PlatformRefreshStatus {
  name: string;
  lastRefreshAt: string | null;
  itemCount: number;
  error?: string;
}

const LOCK_KEY = 'scheduler:refresh-lock';
const LOCK_TTL_SECONDS = 120; // Lock expires after 2 minutes to prevent deadlocks

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly refreshIntervalMs: number;
  private readonly platformStatus: Map<
    string,
    { lastRefreshAt: string | null; itemCount: number; error?: string }
  > = new Map();

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => FeedsService))
    private readonly feedsService: FeedsService,
    private readonly cacheService: CacheService,
  ) {
    const intervalSecs = this.configService.get<number>(
      'REFRESH_INTERVAL_SECS',
      300,
    );
    this.refreshIntervalMs = intervalSecs * 1000;
    this.logger.log(
      `Scheduler configured with refresh interval: ${intervalSecs}s`,
    );
  }

  onModuleInit() {
    // Initialize status entries for all known platforms
    const platforms = this.feedsService.getAvailablePlatforms();
    for (const platform of platforms) {
      this.platformStatus.set(platform.name, {
        lastRefreshAt: null,
        itemCount: 0,
      });
    }
    this.logger.log(
      `Initialized status tracking for ${platforms.length} platforms`,
    );
  }

  /**
   * Periodic refresh that runs every 5 minutes (default).
   * Uses a distributed Redis lock so only one aggregator instance
   * performs the refresh at any given time.
   */
  @Interval(300_000)
  async handleScheduledRefresh(): Promise<void> {
    await this.runRefreshWithLock();
  }

  /**
   * Acquire a distributed lock via Redis SETNX and, if successful,
   * iterate over all platforms and fetch their feeds.
   */
  async runRefreshWithLock(): Promise<void> {
    const lockAcquired = await this.cacheService.setnx(
      LOCK_KEY,
      new Date().toISOString(),
      LOCK_TTL_SECONDS,
    );

    if (!lockAcquired) {
      this.logger.debug(
        'Another instance holds the refresh lock — skipping this cycle',
      );
      return;
    }

    this.logger.log('Acquired refresh lock — starting scheduled feed refresh');

    const platforms = this.feedsService.getAvailablePlatforms();

    for (const platform of platforms) {
      const platformName = platform.name;
      try {
        this.logger.log(`Refreshing feed: ${platformName}`);
        const items = await this.feedsService.fetchFeed(platformName);
        const now = new Date().toISOString();

        this.platformStatus.set(platformName, {
          lastRefreshAt: now,
          itemCount: items.length,
        });

        this.logger.log(
          `Feed "${platformName}" refreshed successfully — ${items.length} items`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        this.platformStatus.set(platformName, {
          lastRefreshAt:
            this.platformStatus.get(platformName)?.lastRefreshAt ?? null,
          itemCount:
            this.platformStatus.get(platformName)?.itemCount ?? 0,
          error: message,
        });

        this.logger.error(
          `Failed to refresh feed "${platformName}": ${message}`,
        );
      }
    }

    // Release the lock early by deleting it once we are done
    await this.cacheService.delete(LOCK_KEY);

    this.logger.log('Scheduled feed refresh complete — lock released');
  }

  /**
   * Return per-platform status including last refresh time, item count,
   * and any error from the most recent refresh attempt.
   */
  getRefreshStatus(): PlatformRefreshStatus[] {
    const platforms = this.feedsService.getAvailablePlatforms();

    return platforms.map((p) => {
      const status = this.platformStatus.get(p.name);
      return {
        name: p.name,
        lastRefreshAt: status?.lastRefreshAt ?? null,
        itemCount: status?.itemCount ?? 0,
        ...(status?.error ? { error: status.error } : {}),
      };
    });
  }
}
