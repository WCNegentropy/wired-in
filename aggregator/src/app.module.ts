import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ContentModule } from './content/content.module';
import { FeedsModule } from './feeds/feeds.module';
import { CacheModule } from './cache/cache.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { User } from './entities/user.entity';
import { ContentItemEntity } from './entities/content-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>(
          'DATABASE_URL',
          'postgres://postgres:postgres@localhost:5432/wiredin',
        ),
        entities: [User, ContentItemEntity],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    CacheModule,
    ContentModule,
    FeedsModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
