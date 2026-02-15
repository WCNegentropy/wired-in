import { Controller, Get, Param, Query } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentQueryDto } from '../dto/content-query.dto';

@Controller('api/content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  getAggregatedContent(@Query() query: ContentQueryDto) {
    const platforms = query.platforms
      ? query.platforms.split(',').map((p) => p.trim())
      : undefined;

    return this.contentService.aggregateContent({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      platforms,
      sort: query.sort ?? 'date',
      query: query.q,
    });
  }

  @Get('search')
  searchContent(
    @Query('q') q: string,
    @Query('platforms') platforms?: string,
  ) {
    const platformList = platforms
      ? platforms.split(',').map((p) => p.trim())
      : undefined;

    const results = this.contentService.searchContent(q || '', platformList);
    return { items: results, total: results.length };
  }

  @Get(':platform')
  getContentByPlatform(
    @Param('platform') platform: string,
    @Query() query: ContentQueryDto,
  ) {
    return this.contentService.aggregateContent({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      platforms: [platform],
      sort: query.sort ?? 'date',
      query: query.q,
    });
  }
}
