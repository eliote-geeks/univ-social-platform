import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './event.controller';
import { EventsService } from './event.service';

@Module({ imports: [AuthModule], controllers: [EventsController], providers: [EventsService] })
export class EventsModule {}
