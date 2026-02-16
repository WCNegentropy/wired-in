import { Module, forwardRef } from '@nestjs/common';
import { FeedsModule } from '../feeds/feeds.module';
import { CacheModule } from '../cache/cache.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [forwardRef(() => FeedsModule), CacheModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
