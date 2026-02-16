import { Module, forwardRef } from '@nestjs/common';
import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';
import { ContentModule } from '../content/content.module';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [ContentModule, forwardRef(() => SchedulerModule)],
  controllers: [FeedsController],
  providers: [FeedsService],
  exports: [FeedsService],
})
export class FeedsModule {}
