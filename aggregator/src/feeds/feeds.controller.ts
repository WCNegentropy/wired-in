import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FeedsService } from './feeds.service';

@Controller('api/feeds')
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Get('platforms')
  listPlatforms() {
    return {
      platforms: this.feedsService.getAvailablePlatforms(),
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
