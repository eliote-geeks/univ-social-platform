import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EventRsvpStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEventDto, CursorQueryDto, RsvpDto, UpdateEventDto } from './event.dto';
import { EventsService } from './event.service';

class AttendeesQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(EventRsvpStatus)
  status?: EventRsvpStatus;
}

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@Query() query: CursorQueryDto) {
    return this.events.list({ groupId: query.groupId, pageId: query.pageId }, query.cursor);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateEventDto) {
    return this.events.create(principal.sub, dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.events.getById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateEventDto) {
    return this.events.update(id, principal.sub, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal) {
    await this.events.remove(id, principal.sub);
  }

  @Post(':id/rsvp')
  @UseGuards(JwtAuthGuard)
  rsvp(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: RsvpDto) {
    return this.events.rsvp(id, principal.sub, dto.status);
  }

  @Delete(':id/rsvp')
  @UseGuards(JwtAuthGuard)
  async removeRsvp(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal) {
    await this.events.removeRsvp(id, principal.sub);
  }

  @Get(':id/attendees')
  listAttendees(@Param('id') id: string, @Query() query: AttendeesQueryDto) {
    return this.events.listAttendees(id, query.status, query.cursor);
  }
}
