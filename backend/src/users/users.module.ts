import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ imports: [AuthModule, MediaModule, NotificationsModule], controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
