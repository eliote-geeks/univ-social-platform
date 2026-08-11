import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/event.module';
import { GroupsModule } from './groups/group.module';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import { MessagingModule } from './messaging/messaging.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PagesModule } from './pages/page.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => {
        if (!env.JWT_SECRET && env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required');
        return env;
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MediaModule,
    NotificationsModule,
    MessagingModule,
    PostsModule,
    GroupsModule,
    PagesModule,
    EventsModule,
    ModerationModule,
  ],
})
export class AppModule {}
