import { EventRsvpStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CursorQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  groupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pageId?: string;
}

export class CreateEventDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  location?: string;

  @IsOptional()
  @IsUrl()
  onlineUrl?: string;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  // Au plus l'un des deux : validé explicitement dans EventsService.create (pas exprimable
  // proprement avec class-validator seul, qui valide chaque champ indépendamment).
  @IsOptional()
  @IsString()
  @MaxLength(64)
  groupSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pageSlug?: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  location?: string;

  @IsOptional()
  @IsUrl()
  onlineUrl?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;
}

export class RsvpDto {
  @IsEnum(EventRsvpStatus)
  status!: EventRsvpStatus;
}
