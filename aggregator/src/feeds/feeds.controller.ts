import { Controller, Get, Inject, Param, Post, Query, forwardRef } from '@nestjs/common';
import { FeedsService } from './feeds.service';
import { SchedulerService } from '../scheduler/scheduler.service';

@Controller('api/feeds')
export class FeedsController {
  constructor(
    private readonly feedsService: FeedsService,
    @Inject(forwardRef(() => SchedulerService))
    private readonly schedulerService: SchedulerService,
  ) {}

  @Get('platforms')
  listPlatforms() {
    return {
      platforms: this.feedsService.getAvailablePlatforms(),
    };
  }

  @Get('status')
  getStatus() {
    return {
      platforms: this.schedulerService.getRefreshStatus(),
    };
  }

  @Post('refresh')
  async refreshAll() {
    return this.feedsService.refreshAll();
  }

  @Get(':platform/search')
  async searchPlatformFeed(
    @Param('platform') platform: string,
    @Query('q') q: string,
  ) {
    const items = await this.feedsService.searchPlatformFeed(
      platform,
      q || '',
    );
    return { items, total: items.length };
  }

  @Get(':platform')
  async getFeed(@Param('platform') platform: string) {
    const items = await this.feedsService.fetchFeed(platform);
    return { items, total: items.length, platform };
  }
}
