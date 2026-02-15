import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getServiceInfo() {
    return {
      service: 'wired-in-aggregator',
      version: '0.1.0',
      description:
        'Wired-In Aggregation Service — data normalization and caching layer between the gateway and platform workers.',
      endpoints: {
        health: 'GET /health',
        content: {
          aggregate: 'GET /api/content',
          byPlatform: 'GET /api/content/:platform',
          search: 'GET /api/content/search?q=query',
        },
        feeds: {
          byPlatform: 'GET /api/feeds/:platform',
          searchPlatform: 'GET /api/feeds/:platform/search?q=query',
          platforms: 'GET /api/feeds/platforms',
          refresh: 'POST /api/feeds/refresh',
        },
      },
      queryParams: {
        limit: 'number (default: 20)',
        offset: 'number (default: 0)',
        platforms: 'string (comma-separated platform names)',
        sort: 'date | score | relevance (default: date)',
        q: 'string (search query)',
      },
    };
  }
}
